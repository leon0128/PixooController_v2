import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Scene } from './scene.entity';

/**
 * Every display type Draw/SendHttpItemList supports, named after Divoom's own
 * DIVOOM_DISP_CUSTOM_DIAL_SUPPORT_* constants.
 * http://doc.divoom-gz.com/web/#/12?page_id=234
 *
 * The device fills in the value for all of them except `text` and `url_text`,
 * which display what the element carries in its `text` field. The numeric code the
 * device expects is derived when the request is built — see PIXOO_ITEM_TYPES.
 */
export const SCENE_ELEMENT_TYPES = [
  'second',
  'minute',
  'hour',
  'am_pm',
  'hour_minute',
  'hour_minute_second',
  'year',
  'day',
  'month',
  'month_year',
  'english_month_day',
  'day_month_year',
  'weekday_short',
  'weekday_medium',
  'weekday_long',
  'english_month',
  'temperature',
  'temperature_max',
  'temperature_min',
  'weather',
  'noise',
  'text',
  'url_text',
] as const;

export type SceneElementType = (typeof SCENE_ELEMENT_TYPES)[number];

/** The two types whose content comes from the element rather than the device. */
export const TEXT_BEARING_TYPES: readonly SceneElementType[] = ['text', 'url_text'];

/**
 * TextId is assigned from an element's position in the scene and the device
 * requires it to stay below 40, which caps how many elements a scene can hold.
 */
export const MAX_SCENE_ELEMENTS = 39;

/** Horizontal text alignment, as the device numbers it. */
export const TEXT_ALIGNMENTS = {
  left: 1,
  middle: 2,
  right: 3,
} as const;

export const TEXT_ALIGNMENT_VALUES = Object.values(TEXT_ALIGNMENTS);

/** Which way text travels when it is too wide for its area. */
export const SCROLL_DIRECTIONS = {
  left: 0,
  right: 1,
} as const;

export const SCROLL_DIRECTION_VALUES = Object.values(SCROLL_DIRECTIONS);

/** One text element overlaid on a scene, mapped onto a Draw/SendHttpItemList entry. */
@Entity('scene_elements')
export class SceneElement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  sceneId: number;

  @ManyToOne(() => Scene, (scene) => scene.elements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scene_id' })
  scene: Scene;

  @Column({ type: 'varchar', length: 32 })
  type: SceneElementType;

  /**
   * The string sent as TextString: the literal text for `text`, the URL to poll
   * for `url_text`. Null for every other type, where the device supplies the value.
   * The device caps TextString at 512 characters.
   */
  @Column({ type: 'varchar', length: 512, nullable: true })
  text: string | null;

  @Column({ type: 'int' })
  x: number;

  @Column({ type: 'int' })
  y: number;

  @Column({ type: 'int' })
  dir: number;

  @Column({ type: 'int' })
  font: number;

  @Column({ type: 'int' })
  textWidth: number;

  @Column({ type: 'int' })
  textHeight: number;

  @Column({ type: 'int' })
  speed: number;

  /** Hex color as the device expects it, e.g. "#FFFFFF". */
  @Column({ type: 'varchar', length: 7 })
  color: string;

  @Column({ type: 'int' })
  updateTime: number;

  @Column({ type: 'int' })
  align: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
