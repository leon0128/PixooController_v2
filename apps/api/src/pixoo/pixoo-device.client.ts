import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DiscoveredDevice, PixooCommand, PixooFont } from './pixoo.types';

const DISCOVERY_URL = 'https://app.divoom-gz.com/Device/ReturnSameLanDevice';
const FONT_LIST_URL = 'https://appin.divoom-gz.com/Device/GetTimeDialFont';
const DISCOVERY_TIMEOUT_MS = 10_000;

/**
 * How long to wait for the device to answer, in milliseconds.
 *
 * The device works through a request before replying, and that scales with the
 * payload: a 60-frame background is roughly 1 MB and takes it about six seconds.
 * The default leaves room for that plus a slow network; raise it with
 * PIXOO_REQUEST_TIMEOUT_MS if a large scene still times out.
 */
const DEFAULT_DEVICE_TIMEOUT_MS = 30_000;

/** Attempts per command, and the pause between them. */
const DEVICE_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2_000;

/**
 * Parses one entry of GetTimeDialFont, which arrives as a comma-separated string
 * rather than an object: `id,type,width,height,assetPath,charset`.
 *
 * The charset can itself contain commas, so it is taken as everything past the
 * asset path instead of as a single field. Entries that do not parse are dropped —
 * one malformed row should not cost the whole catalogue.
 */
export function parseFontEntry(entry: string): PixooFont | null {
  const parts = entry.split(',');
  if (parts.length < 5) return null;

  const [id, type, width, height] = parts.map((part) => part.trim());
  if (![id, type, width, height].every((value) => /^\d+$/.test(value))) return null;

  return {
    id: Number(id),
    type: Number(type),
    width: Number(width),
    height: Number(height),
    charset: parts.slice(5).join(','),
  };
}

/**
 * The body as it appears in the log. A frame of PicData is 16 KB of Base64 that
 * says nothing when read, so it is stood in for while every other field — the ones
 * worth checking against the device's behaviour — is printed in full.
 */
function toLogBody(command: PixooCommand): string {
  return JSON.stringify(command, (key, value: unknown) =>
    key === 'PicData' ? '(Base64 image data)' : value,
  );
}

@Injectable()
export class PixooDeviceClient {
  private readonly logger = new Logger(PixooDeviceClient.name);
  private readonly deviceTimeoutMs: number;
  /** The last device discovery returned, kept only for the process lifetime. */
  private lastKnown: DiscoveredDevice | null = null;

  constructor(config: ConfigService) {
    this.deviceTimeoutMs = Number(
      config.get('PIXOO_REQUEST_TIMEOUT_MS') ?? DEFAULT_DEVICE_TIMEOUT_MS,
    );
  }

  /**
   * Asks Divoom which of its devices share this LAN. Nothing about the device is
   * persisted, so this runs immediately before every push.
   *
   * Divoom's service has been observed answering `ReturnCode: 0` with an empty list
   * while the device itself was answering on the LAN in under 100 ms, which would
   * otherwise leave a perfectly healthy device uncontrollable. The last device it
   * did return is therefore kept in memory and used when a later lookup comes back
   * empty. It is only a process-lifetime cache — a restart starts over — so the
   * address is still never persisted.
   */
  async discover(): Promise<DiscoveredDevice> {
    let payload: { ReturnCode?: number; ReturnMessage?: string; DeviceList?: DiscoveredDevice[] };

    this.logger.debug(`POST ${DISCOVERY_URL}`);

    try {
      const response = await fetch(DISCOVERY_URL, {
        method: 'POST',
        signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      payload = await response.json();
    } catch (error) {
      return this.fallbackTo(`discovery failed: ${(error as Error).message}`);
    }

    this.logger.debug(`FindDevice <- ${JSON.stringify(payload)}`);

    if (payload.ReturnCode !== 0) {
      return this.fallbackTo(
        `discovery returned code ${payload.ReturnCode}: ${payload.ReturnMessage ?? ''}`,
      );
    }

    const device = payload.DeviceList?.[0];
    if (!device?.DevicePrivateIP) {
      return this.fallbackTo('discovery found no device on this network');
    }

    this.lastKnown = device;
    this.logger.log(`Found ${device.DeviceName} at ${device.DevicePrivateIP}`);
    return device;
  }

  /** Uses the last device discovery returned, or gives up if there has not been one. */
  private fallbackTo(reason: string): DiscoveredDevice {
    if (!this.lastKnown) {
      throw new ServiceUnavailableException(`No Pixoo device available: ${reason}`);
    }

    this.logger.warn(
      `${reason}; falling back to the last known address ${this.lastKnown.DevicePrivateIP}`,
    );
    return this.lastKnown;
  }

  /**
   * The fonts the device can render text in, from Divoom's catalogue.
   *
   * Returns an empty list rather than throwing when the catalogue is unavailable:
   * the font is only a number in a form, and not being able to describe it should
   * not stop a scene from being edited.
   */
  async fetchFonts(): Promise<PixooFont[]> {
    let payload: { ReturnCode?: number; FontList?: unknown };

    this.logger.debug(`POST ${FONT_LIST_URL}`);

    try {
      const response = await fetch(FONT_LIST_URL, {
        method: 'POST',
        signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      payload = await response.json();
    } catch (error) {
      this.logger.warn(`Font list unavailable: ${(error as Error).message}`);
      return [];
    }

    if (payload.ReturnCode !== 0 || !Array.isArray(payload.FontList)) {
      this.logger.warn(
        `GetTimeDialFont returned code ${payload.ReturnCode} with no usable list`,
      );
      return [];
    }

    const fonts = payload.FontList.filter(
      (entry): entry is string => typeof entry === 'string',
    )
      .map(parseFontEntry)
      .filter((font): font is PixooFont => font !== null)
      .sort((a, b) => a.id - b.id);

    this.logger.debug(
      `GetTimeDialFont <- ${payload.FontList.length} entrie(s), ${fonts.length} parsed`,
    );
    return fonts;
  }

  /**
   * POSTs one command and fails loudly on a non-zero error_code.
   *
   * A request that never gets answered is retried. After accepting a large
   * animation the device goes unresponsive for a few seconds while it renders,
   * and no fixed delay reliably avoids that window. Retrying is safe because every
   * command sets state rather than accumulating it — sending one twice is the same
   * as sending it once. A non-zero error_code is a real rejection and is not
   * retried.
   */
  async send(ip: string, command: PixooCommand, step?: string): Promise<void> {
    const url = `http://${ip}:80/post`;
    const body = JSON.stringify(command);
    const label = step ? `[${step}] ` : '';

    this.logger.debug(`${label}POST ${url} ${toLogBody(command)}`);

    let lastError = '';
    for (let attempt = 1; attempt <= DEVICE_ATTEMPTS; attempt++) {
      let payload: { error_code?: number };

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: AbortSignal.timeout(this.deviceTimeoutMs),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        payload = await response.json();
      } catch (error) {
        lastError = (error as Error).message;
        this.logger.warn(
          `${label}${command.Command} attempt ${attempt}/${DEVICE_ATTEMPTS} failed: ${lastError}`,
        );
        if (attempt < DEVICE_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
        continue;
      }

      this.logger.debug(`${label}${command.Command} <- ${JSON.stringify(payload)}`);

      if (payload.error_code !== 0) {
        throw new BadGatewayException(
          `${command.Command} rejected by ${ip} with error_code ${payload.error_code}`,
        );
      }
      return;
    }

    throw new BadGatewayException(
      `${command.Command} failed against ${ip} after ${DEVICE_ATTEMPTS} attempts: ${lastError}`,
    );
  }
}
