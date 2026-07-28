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

@Injectable()
export class PixooDeviceClient {
  private readonly logger = new Logger(PixooDeviceClient.name);

  /**
   * Asks Divoom which of its devices share this LAN. Nothing about the device is
   * persisted, so this runs immediately before every push.
   */
  async discover(): Promise<DiscoveredDevice> {
    let payload: { ReturnCode?: number; ReturnMessage?: string; DeviceList?: DiscoveredDevice[] };

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
    let payload: { error_code?: number };

    try {
      const response = await fetch(`http://${ip}:80/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
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

    if (payload.error_code !== 0) {
      throw new BadGatewayException(
        `${command.Command} rejected by ${ip} with error_code ${payload.error_code}`,
      );
    }
  }
}
