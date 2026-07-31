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
  Validate,
  ValidateIf,
  ValidateNested,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { IsPicData } from '../../common/validators/is-pic-data.validator';
import {
  MAX_SCENE_ELEMENTS,
  SCENE_ELEMENT_TYPES,
  SCROLL_DIRECTION_VALUES,
  TEXT_ALIGNMENT_VALUES,
  TEXT_BEARING_TYPES,
} from '../entities/scene-element.entity';
import type { SceneElementType } from '../entities/scene-element.entity';

const bearsText = (element: SceneElementDto) =>
  TEXT_BEARING_TYPES.includes(element.type);

/** Keeps the thumbnail pointing at a frame the image actually has. */
@ValidatorConstraint({ name: 'isExistingFrameIndex' })
class IsExistingFrameIndex implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const { frames } = args.object as SceneImageDto;
    return typeof value !== 'number' || (Array.isArray(frames) && value < frames.length);
  }

  defaultMessage(args: ValidationArguments): string {
    const { frames } = args.object as SceneImageDto;
    return `thumbnailFrameIndex must be below the frame count (${frames?.length ?? 0})`;
  }
}

export class SceneElementDto {
  @IsIn(SCENE_ELEMENT_TYPES)
  type: SceneElementType;

  /**
   * The literal string for `text` and the URL to poll for `url_text`. Every other
   * type has its value produced by the device, so it is left unset.
   */
  // Only validated for the types that need it; for the rest the service drops
  // whatever came in, since the device produces the value itself.
  @ValidateIf(bearsText)
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  text?: string | null;

  @IsInt()
  @Min(0)
  @Max(63)
  x: number;

  @IsInt()
  @Min(0)
  @Max(63)
  y: number;

  /** 0: scroll left, 1: scroll right — the device defines no other value. */
  @IsIn(SCROLL_DIRECTION_VALUES)
  dir: number;

  @IsInt()
  @Min(0)
  font: number;

  @IsInt()
  @Min(1)
  @Max(64)
  textWidth: number;

  @IsInt()
  @Min(1)
  @Max(64)
  textHeight: number;

  @IsInt()
  @Min(0)
  speed: number;

  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a hex value like #FFFFFF' })
  color: string;

  @IsInt()
  @Min(0)
  updateTime: number;

  /** 1: left, 2: middle, 3: right — the device rejects anything else. */
  @IsIn(TEXT_ALIGNMENT_VALUES)
  align: number;
}

export class SceneImageDto {
  /** Loop interval sent as Draw/SendHttpGif's PicSpeed. */
  @IsInt()
  @Min(0)
  picSpeed: number;

  /**
   * Which frame represents the scene in listings. Defaults to the first, and has to
   * point at a frame that exists — a stale index would leave the listing blank.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Validate(IsExistingFrameIndex)
  thumbnailFrameIndex?: number;

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

  /**
   * Capped because TextId is assigned from the element's position in this array and
   * the device requires it to stay below 40.
   */
  @IsArray()
  @ArrayMaxSize(MAX_SCENE_ELEMENTS)
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
