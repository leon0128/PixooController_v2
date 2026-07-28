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
 * Which Pixoo ItemList entry a scene element renders as. The numeric `type` code
 * the device expects is derived from this when the request is built, so it is not
 * stored — see PIXOO_ITEM_TYPES in the pixoo module for the mapping.
 *
 * The date is split into three separately positioned elements because the device
 * renders the month, the separator and the day as three independent ItemList
 * entries, each with its own coordinates and size.
 */
export type SceneElementType =
  | 'date_month'
  | 'date_separator'
  | 'date_day'
  | 'day_of_week'
  | 'time'
  | 'temperature';

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
