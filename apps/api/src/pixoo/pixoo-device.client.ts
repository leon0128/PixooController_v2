import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { DiscoveredDevice, PixooCommand } from './pixoo.types';

const DISCOVERY_URL = 'https://app.divoom-gz.com/Device/ReturnSameLanDevice';
const DISCOVERY_TIMEOUT_MS = 10_000;
const DEVICE_TIMEOUT_MS = 5_000;

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

  /** POSTs one command and fails loudly on a non-zero error_code. */
  async send(ip: string, command: PixooCommand): Promise<void> {
    const url = `http://${ip}:80/post`;
    const body = JSON.stringify(command);
    let payload: { error_code?: number };

    this.logger.debug(`POST ${url} ${toLogBody(command)}`);

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

    this.logger.debug(`${command.Command} <- ${JSON.stringify(payload)}`);

    if (payload.error_code !== 0) {
      throw new BadGatewayException(
        `${command.Command} rejected by ${ip} with error_code ${payload.error_code}`,
      );
    }
  }
}
