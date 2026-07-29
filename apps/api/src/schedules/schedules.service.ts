import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { Scene } from '../scenes/entities/scene.entity';
import { ReplaceSchedulesDto, ScheduleEntryDto } from './dto/replace-schedules.dto';
import { Schedule } from './entities/schedule.entity';
import { resolveActiveMarker } from './schedule-resolver';

@Injectable()
export class SchedulesService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  findAll(): Promise<Schedule[]> {
    return this.dataSource.getRepository(Schedule).find({
      order: { dayOfWeek: 'ASC', slot: 'ASC' },
    });
  }

  /** The entry whose scene should be playing at `now`, or null if none is scheduled. */
  async findActive(now: Date): Promise<Schedule | null> {
    return resolveActiveMarker(await this.findAll(), now);
  }

  /** Replaces the whole week in one transaction. */
  async replaceAll(dto: ReplaceSchedulesDto): Promise<Schedule[]> {
    this.assertNoDuplicateSlots(dto.entries);
    await this.assertScenesExist(dto.entries);

    await this.dataSource.transaction(async (manager) => {
      // delete({}) is rejected by TypeORM as an empty criteria, so clear via a builder.
      await manager.createQueryBuilder().delete().from(Schedule).execute();
      if (dto.entries.length > 0) {
        await manager.getRepository(Schedule).insert(dto.entries);
      }
    });

    return this.findAll();
  }

  private assertNoDuplicateSlots(entries: ScheduleEntryDto[]): void {
    const seen = new Set<string>();
    for (const entry of entries) {
      const key = `${entry.dayOfWeek}:${entry.slot}`;
      if (seen.has(key)) {
        throw new BadRequestException(
          `Duplicate entry for day ${entry.dayOfWeek} slot ${entry.slot}`,
        );
      }
      seen.add(key);
    }
  }

  private async assertScenesExist(entries: ScheduleEntryDto[]): Promise<void> {
    const ids = [...new Set(entries.map((entry) => entry.sceneId))];
    if (ids.length === 0) return;

    const found = await this.dataSource
      .getRepository(Scene)
      .find({ where: { id: In(ids) }, select: { id: true } });

    const missing = ids.filter((id) => !found.some((scene) => scene.id === id));
    if (missing.length > 0) {
      throw new BadRequestException(`Unknown scene id(s): ${missing.join(', ')}`);
    }
  }
}
