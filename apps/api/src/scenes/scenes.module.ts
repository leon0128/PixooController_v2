import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PixooModule } from '../pixoo/pixoo.module';
import { SceneElement } from './entities/scene-element.entity';
import { SceneImage } from './entities/scene-image.entity';
import { SceneImageDetail } from './entities/scene-image-detail.entity';
import { Scene } from './entities/scene.entity';
import { ScenesController } from './scenes.controller';
import { ScenesService } from './scenes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Scene, SceneImage, SceneImageDetail, SceneElement]),
    PixooModule,
  ],
  controllers: [ScenesController],
  providers: [ScenesService],
})
export class ScenesModule {}
