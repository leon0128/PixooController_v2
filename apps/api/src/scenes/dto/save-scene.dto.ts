import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsPicData } from '../../common/validators/is-pic-data.validator';
import type { SceneElementType } from '../entities/scene-element.entity';

const SCENE_ELEMENT_TYPES: SceneElementType[] = [
  'date_month',
  'date_separator',
  'date_day',
  'day_of_week',
  'time',
  'temperature',
];

export class SceneElementDto {
  @IsIn(SCENE_ELEMENT_TYPES)
  type: SceneElementType;

  @IsInt()
  @Min(0)
  @Max(63)
  x: number;

  @IsInt()
  @Min(0)
  @Max(63)
  y: number;

  @IsInt()
  dir: number;

  @IsInt()
  font: number;

  @IsInt()
  @Min(1)
  textWidth: number;

  @IsInt()
  @Min(1)
  textHeight: number;

  @IsInt()
  @Min(0)
  speed: number;

  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a hex value like #FFFFFF' })
  color: string;

  @IsInt()
  @Min(0)
  updateTime: number;

  @IsInt()
  align: number;
}

export class SceneImageDto {
  /** Loop interval sent as Draw/SendHttpGif's PicSpeed. */
  @IsInt()
  @Min(0)
  picSpeed: number;

  /**
   * Frames in loop order — the array index becomes the stored frame_index, so the
   * client never has to assign one.
   */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(60)
  @IsPicData({ each: true })
  frames: string[];
}

/**
 * What a scene actually displays. Shared by the stored scene and by previews,
 * which render the same content without ever touching the database.
 */
export class SceneContentDto {
  /** Omit or send null for a scene with no background image. */
  @IsOptional()
  @ValidateNested()
  @Type(() => SceneImageDto)
  image?: SceneImageDto | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SceneElementDto)
  elements: SceneElementDto[];
}

/**
 * A scene and everything it owns. Used for both create and replace: a PUT carries
 * the complete desired state, and any element or frame missing from it is removed.
 */
export class SaveSceneDto extends SceneContentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;
}
