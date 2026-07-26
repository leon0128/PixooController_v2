import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Scene } from './scene.entity';
import { SceneImageDetail } from './scene-image-detail.entity';

/** Background image loop settings for a scene. At most one per scene. */
@Entity('scene_images')
export class SceneImage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  sceneId: number;

  @OneToOne(() => Scene, (scene) => scene.image, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scene_id' })
  scene: Scene;

  /** Loop interval sent as Draw/SendHttpGif's PicSpeed. */
  @Column({ type: 'int' })
  picSpeed: number;

  @OneToMany(() => SceneImageDetail, (detail) => detail.sceneImage, {
    cascade: true,
  })
  details: SceneImageDetail[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
