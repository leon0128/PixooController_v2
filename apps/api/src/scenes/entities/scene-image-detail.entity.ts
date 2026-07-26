import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { SceneImage } from './scene-image.entity';

/** A single 64x64 frame of a scene's background image loop. */
@Entity('scene_image_details')
@Unique(['sceneImageId', 'frameIndex'])
export class SceneImageDetail {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  sceneImageId: number;

  @ManyToOne(() => SceneImage, (image) => image.details, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'scene_image_id' })
  sceneImage: SceneImage;

  /** Position in the loop, sent as Draw/SendHttpGif's PicOffset. */
  @Column({ type: 'int' })
  frameIndex: number;

  /** 64x64 image, Base64-encoded — the exact string sent as PicData. */
  @Column({ type: 'text' })
  imageData: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
