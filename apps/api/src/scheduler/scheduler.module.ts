import { Module } from '@nestjs/common';
import { PixooModule } from '../pixoo/pixoo.module';
import { ScenesModule } from '../scenes/scenes.module';
import { SchedulesModule } from '../schedules/schedules.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [SchedulesModule, ScenesModule, PixooModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
