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
 * stored: time -> 5, day_of_week -> 14, temperature -> 17, and date expands into
 * three entries (9 / 22 / 8).
 */
export type SceneElementType = 'date' | 'day_of_week' | 'time' | 'temperature';

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
