import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { DiscoveredDevice, PixooCommand, PixooFont } from './pixoo.types';

const DISCOVERY_URL = 'https://app.divoom-gz.com/Device/ReturnSameLanDevice';
const FONT_LIST_URL = 'https://appin.divoom-gz.com/Device/GetTimeDialFont';
const DISCOVERY_TIMEOUT_MS = 10_000;
const DEVICE_TIMEOUT_MS = 5_000;

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

  /**
   * Asks Divoom which of its devices share this LAN. Nothing about the device is
   * persisted, so this runs immediately before every push.
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
      throw new ServiceUnavailableException(
        `Device discovery failed: ${(error as Error).message}`,
      );
    }

    this.logger.debug(`FindDevice <- ${JSON.stringify(payload)}`);

    if (payload.ReturnCode !== 0) {
      throw new ServiceUnavailableException(
        `Device discovery returned code ${payload.ReturnCode}: ${payload.ReturnMessage ?? ''}`,
      );
    }

    const device = payload.DeviceList?.[0];
    if (!device?.DevicePrivateIP) {
      throw new ServiceUnavailableException('No Pixoo device found on this network');
    }

    this.logger.log(`Found ${device.DeviceName} at ${device.DevicePrivateIP}`);
    return device;
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

  /** POSTs one command and fails loudly on a non-zero error_code. */
  async send(ip: string, command: PixooCommand, step?: string): Promise<void> {
    const url = `http://${ip}:80/post`;
    const body = JSON.stringify(command);
    const label = step ? `[${step}] ` : '';
    let payload: { error_code?: number };

    this.logger.debug(`${label}POST ${url} ${toLogBody(command)}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(DEVICE_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      payload = await response.json();
    } catch (error) {
      throw new BadGatewayException(
        `${command.Command} failed against ${ip}: ${(error as Error).message}`,
      );
    }

    this.logger.debug(`${label}${command.Command} <- ${JSON.stringify(payload)}`);

    if (payload.error_code !== 0) {
      throw new BadGatewayException(
        `${command.Command} rejected by ${ip} with error_code ${payload.error_code}`,
      );
    }
  }
}
