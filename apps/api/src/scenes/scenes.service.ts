import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { SaveSceneDto } from './dto/save-scene.dto';
import { SceneElement, TEXT_BEARING_TYPES } from './entities/scene-element.entity';
import { SceneImage } from './entities/scene-image.entity';
import { SceneImageDetail } from './entities/scene-image-detail.entity';
import { Scene } from './entities/scene.entity';

/** Relations that make up the scene aggregate, always loaded and saved together. */
const SCENE_RELATIONS = ['image', 'image.details', 'elements'] as const;

@Injectable()
export class ScenesService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  findAll(): Promise<Scene[]> {
    return this.dataSource.getRepository(Scene).find({
      relations: [...SCENE_RELATIONS],
      order: { id: 'ASC', elements: { id: 'ASC' }, image: { details: { frameIndex: 'ASC' } } },
    });
  }

  async findOne(id: number): Promise<Scene> {
    const scene = await this.dataSource.getRepository(Scene).findOne({
      where: { id },
      relations: [...SCENE_RELATIONS],
      order: { elements: { id: 'ASC' }, image: { details: { frameIndex: 'ASC' } } },
    });
    if (!scene) throw new NotFoundException(`Scene ${id} not found`);
    return scene;
  }

  async create(dto: SaveSceneDto): Promise<Scene> {
    const id = await this.dataSource.transaction(async (manager) => {
      const scene = await manager
        .getRepository(Scene)
        .save(manager.getRepository(Scene).create({ name: dto.name }));
      await this.writeChildren(manager, scene.id, dto);
      return scene.id;
    });
    return this.findOne(id);
  }

  /**
   * Full replace: the scene keeps its id (so schedules pointing at it survive), but
   * its elements and image loop are rebuilt from the request.
   */
  async replace(id: number, dto: SaveSceneDto): Promise<Scene> {
    await this.dataSource.transaction(async (manager) => {
      const scene = await manager.getRepository(Scene).findOne({ where: { id } });
      if (!scene) throw new NotFoundException(`Scene ${id} not found`);

      scene.name = dto.name;
      await manager.getRepository(Scene).save(scene);

      // Deleting the image cascades to its frames.
      await manager.getRepository(SceneElement).delete({ sceneId: id });
      await manager.getRepository(SceneImage).delete({ sceneId: id });

      await this.writeChildren(manager, id, dto);
    });
    return this.findOne(id);
  }

  /** Cascades to the scene's image, frames, elements and schedule entries. */
  async remove(id: number): Promise<void> {
    const result = await this.dataSource.getRepository(Scene).delete({ id });
    if (!result.affected) throw new NotFoundException(`Scene ${id} not found`);
  }

  private async writeChildren(
    manager: EntityManager,
    sceneId: number,
    dto: SaveSceneDto,
  ): Promise<void> {
    if (dto.elements.length > 0) {
      await manager.getRepository(SceneElement).insert(
        dto.elements.map((element) => ({
          ...element,
          sceneId,
          // Only the text-bearing types carry content of their own; for the rest the
          // device produces the value, so anything sent is dropped rather than stored.
          text: TEXT_BEARING_TYPES.includes(element.type) ? element.text : null,
        })),
      );
    }

    if (!dto.image) return;

    const image = await manager
      .getRepository(SceneImage)
      .save(
        manager
          .getRepository(SceneImage)
          .create({ sceneId, picSpeed: dto.image.picSpeed }),
      );

    await manager.getRepository(SceneImageDetail).insert(
      dto.image.frames.map((imageData, frameIndex) => ({
        sceneImageId: image.id,
        frameIndex,
        imageData,
      })),
    );
  }
}
