import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PixooService } from '../pixoo/pixoo.service';
import { SchedulesService } from '../schedules/schedules.service';
import { ScenesService } from '../scenes/scenes.service';

/**
 * Drives the device from the weekly schedule.
 *
 * The device keeps animating, ticking the clock and refreshing the temperature on
 * its own, so a scene only has to be sent when the schedule actually moves to a
 * different one. Re-sending an unchanged scene would restart its loop from the
 * first frame for no reason.
 */
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  /** undefined until the first tick; null means "nothing was scheduled". */
  private lastPushedSceneId: number | null | undefined;

  constructor(
    private readonly schedulesService: SchedulesService,
    private readonly scenesService: ScenesService,
    private readonly pixooService: PixooService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async tick(): Promise<void> {
    await this.applySchedule(new Date());
  }

  /** Exposed separately from the cron so it can be driven with a fixed clock. */
  async applySchedule(now: Date): Promise<void> {
    const active = await this.schedulesService.findActive(now);
    const sceneId = active?.sceneId ?? null;

    if (sceneId === this.lastPushedSceneId) return;

    if (sceneId === null) {
      // Nothing scheduled: leave whatever is on the display alone.
      this.logger.log('No scene scheduled; leaving the device untouched');
      this.lastPushedSceneId = null;
      return;
    }

    try {
      const scene = await this.scenesService.findOne(sceneId);
      await this.pixooService.push(PixooService.fromEntity(scene));
      // Only remember it once the push actually landed, so failures retry.
      this.lastPushedSceneId = sceneId;
      this.logger.log(`Switched to scene ${sceneId} (${scene.name})`);
    } catch (error) {
      this.logger.error(
        `Failed to switch to scene ${sceneId}: ${(error as Error).message}`,
      );
    }
  }
}
