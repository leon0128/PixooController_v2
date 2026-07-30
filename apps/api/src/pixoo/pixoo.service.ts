import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Scene } from '../scenes/entities/scene.entity';
import { buildSceneRequests } from './pixoo-command.builder';
import { PixooDeviceClient } from './pixoo-device.client';
import type { PixooSceneInput } from './pixoo.types';

/**
 * Pause between consecutive requests to the device, in milliseconds.
 *
 * The device does not finish applying a request by the time it answers: sending the
 * text immediately after an animation has been observed to leave only the animation
 * on screen, as if the text were overwritten once playback started. Tune this with
 * PIXOO_REQUEST_INTERVAL_MS to find what this device needs.
 */
const DEFAULT_REQUEST_INTERVAL_MS = 500;

@Injectable()
export class PixooService {
  private readonly logger = new Logger(PixooService.name);
  private readonly requestIntervalMs: number;

  constructor(
    private readonly client: PixooDeviceClient,
    config: ConfigService,
  ) {
    this.requestIntervalMs = Number(
      config.get('PIXOO_REQUEST_INTERVAL_MS') ?? DEFAULT_REQUEST_INTERVAL_MS,
    );
  }

  /**
   * Pushes a scene in four steps: resolve the device address, clear both layers,
   * send the background, send the text. Consecutive device requests are spaced by
   * `requestIntervalMs`.
   */
  async push(scene: PixooSceneInput): Promise<void> {
    const device = await this.client.discover();
    const requests = buildSceneRequests(scene);

    for (const [index, request] of requests.entries()) {
      if (index > 0) await this.pause();
      await this.client.send(device.DevicePrivateIP, request.command, request.step);
    }

    this.logger.log(
      `Pushed a scene to ${device.DevicePrivateIP} in ${requests.length} request(s), ` +
        `${this.requestIntervalMs}ms apart`,
    );
  }

  private pause(): Promise<void> {
    if (this.requestIntervalMs <= 0) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, this.requestIntervalMs));
  }

  /** Flattens a stored scene into the shape the device layer works with. */
  static fromEntity(scene: Scene): PixooSceneInput {
    return {
      image: scene.image
        ? {
            picSpeed: scene.image.picSpeed,
            frames: [...(scene.image.details ?? [])]
              .sort((a, b) => a.frameIndex - b.frameIndex)
              .map((detail) => detail.imageData),
          }
        : null,
      elements: scene.elements ?? [],
    };
  }
}
