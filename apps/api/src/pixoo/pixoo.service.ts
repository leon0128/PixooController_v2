import { Injectable, Logger } from '@nestjs/common';
import type { Scene } from '../scenes/entities/scene.entity';
import { buildSceneCommands } from './pixoo-command.builder';
import { PixooDeviceClient } from './pixoo-device.client';
import type { PixooSceneInput } from './pixoo.types';

@Injectable()
export class PixooService {
  private readonly logger = new Logger(PixooService.name);

  constructor(private readonly client: PixooDeviceClient) {}

  /**
   * Discovers the device and pushes the scene. Commands go out in order because the
   * device treats them as a sequence: clear, then frames, then text.
   */
  async push(scene: PixooSceneInput): Promise<void> {
    const device = await this.client.discover();
    const commands = buildSceneCommands(scene);

    for (const command of commands) {
      await this.client.send(device.DevicePrivateIP, command);
    }

    this.logger.log(
      `Pushed ${commands.length} command(s) to ${device.DevicePrivateIP}`,
    );
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
