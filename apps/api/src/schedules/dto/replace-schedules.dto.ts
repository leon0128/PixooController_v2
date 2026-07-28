import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * The point at which a scene starts. It has no end: the scene runs until the next
 * entry on the weekly timeline, wrapping from Saturday back to Sunday.
 */
export class ScheduleEntryDto {
  /** 0 = Sunday through 6 = Saturday. */
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  /** 0-143; slot n starts at n*10 minutes after midnight. */
  @IsInt()
  @Min(0)
  @Max(143)
  slot: number;

  @IsInt()
  @Min(1)
  sceneId: number;
}

/** Replaces the entire weekly schedule. An empty list means nothing is scheduled. */
export class ReplaceSchedulesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleEntryDto)
  entries: ScheduleEntryDto[];
}
