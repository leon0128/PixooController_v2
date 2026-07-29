import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Scene } from '../../scenes/entities/scene.entity';

/** Number of 10-minute slots in a day. */
export const SLOTS_PER_DAY = 144;

/**
 * Assigns a scene to one 10-minute slot of one weekday. A slot with no row simply
 * has no scene scheduled.
 */
@Entity('schedules')
@Unique(['dayOfWeek', 'slot'])
@Check('"day_of_week" BETWEEN 0 AND 6')
@Check('"slot" BETWEEN 0 AND 143')
export class Schedule {
  @PrimaryGeneratedColumn()
  id: number;

  /** 0 = Sunday through 6 = Saturday. */
  @Column({ type: 'smallint' })
  dayOfWeek: number;

  /** 0-143; slot n covers n*10 minutes from midnight. */
  @Column({ type: 'smallint' })
  slot: number;

  @Column()
  sceneId: number;

  @ManyToOne(() => Scene, (scene) => scene.schedules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scene_id' })
  scene: Scene;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
