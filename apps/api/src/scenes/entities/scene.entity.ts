import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Schedule } from '../../schedules/entities/schedule.entity';
import { SceneElement } from './scene-element.entity';
import { SceneImage } from './scene-image.entity';

@Entity('scenes')
export class Scene {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  /** A scene may have no background image at all. */
  @OneToOne(() => SceneImage, (image) => image.scene, { cascade: true })
  image: SceneImage | null;

  @OneToMany(() => SceneElement, (element) => element.scene, { cascade: true })
  elements: SceneElement[];

  @OneToMany(() => Schedule, (schedule) => schedule.scene)
  schedules: Schedule[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
