import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { PixooService } from '../pixoo/pixoo.service';
import { SaveSceneDto, SceneContentDto } from './dto/save-scene.dto';
import { Scene } from './entities/scene.entity';
import { ScenesService } from './scenes.service';

@Controller('scenes')
export class ScenesController {
  constructor(
    private readonly scenesService: ScenesService,
    private readonly pixooService: PixooService,
  ) {}

  /**
   * Renders arbitrary scene content on the device without saving it — used to
   * preview what is being edited. Declared before :id so it is not read as an id.
   */
  @Post('preview')
  @HttpCode(HttpStatus.NO_CONTENT)
  preview(@Body() dto: SceneContentDto): Promise<void> {
    return this.pixooService.push({
      image: dto.image ?? null,
      elements: dto.elements,
    });
  }

  @Get()
  findAll(): Promise<Scene[]> {
    return this.scenesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Scene> {
    return this.scenesService.findOne(id);
  }

  @Post()
  create(@Body() dto: SaveSceneDto): Promise<Scene> {
    return this.scenesService.create(dto);
  }

  @Put(':id')
  replace(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveSceneDto,
  ): Promise<Scene> {
    return this.scenesService.replace(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.scenesService.remove(id);
  }

  /** Plays a stored scene on the device straight away. */
  @Post(':id/push')
  @HttpCode(HttpStatus.NO_CONTENT)
  async push(@Param('id', ParseIntPipe) id: number): Promise<void> {
    const scene = await this.scenesService.findOne(id);
    await this.pixooService.push(PixooService.fromEntity(scene));
  }
}
