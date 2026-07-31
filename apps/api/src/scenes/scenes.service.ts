import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { SaveSceneDto } from './dto/save-scene.dto';
import { SceneElement, TEXT_BEARING_TYPES } from './entities/scene-element.entity';
import { SceneImage } from './entities/scene-image.entity';
import { SceneImageDetail } from './entities/scene-image-detail.entity';
import { Scene } from './entities/scene.entity';

const COPY_SUFFIX = ' - Copy';
/** Names are capped at 255, so a long one loses its tail rather than the suffix. */
function copyNameFor(name: string): string {
  return name.slice(0, 255 - COPY_SUFFIX.length) + COPY_SUFFIX;
}

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
   * Duplicates a scene under a "<name> - Copy" title.
   *
   * Goes through `create` rather than copying rows directly, so the duplicate is
   * written exactly like any other new scene: its image, frames and elements are
   * fresh rows of its own. Nothing is shared with the original, and editing either
   * one leaves the other alone.
   */
  async copy(id: number): Promise<Scene> {
    const source = await this.findOne(id);

    return this.create({
      name: copyNameFor(source.name),
      image: source.image
        ? {
            picSpeed: source.image.picSpeed,
            thumbnailFrameIndex: source.image.thumbnailFrameIndex,
            frames: [...(source.image.details ?? [])]
              .sort((a, b) => a.frameIndex - b.frameIndex)
              .map((detail) => detail.imageData),
          }
        : null,
      elements: (source.elements ?? []).map((element) => ({
        type: element.type,
        text: element.text,
        x: element.x,
        y: element.y,
        dir: element.dir,
        font: element.font,
        textWidth: element.textWidth,
        textHeight: element.textHeight,
        speed: element.speed,
        color: element.color,
        updateTime: element.updateTime,
        align: element.align,
      })),
    });
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
          .create({
            sceneId,
            picSpeed: dto.image.picSpeed,
            thumbnailFrameIndex: dto.image.thumbnailFrameIndex ?? 0,
          }),
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
