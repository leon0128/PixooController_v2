import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Scene } from '../scenes/entities/scene.entity';
import { Schedule } from './entities/schedule.entity';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';

@Module({
  imports: [TypeOrmModule.forFeature([Schedule, Scene])],
  controllers: [SchedulesController],
  providers: [SchedulesService],
})
export class SchedulesModule {}
