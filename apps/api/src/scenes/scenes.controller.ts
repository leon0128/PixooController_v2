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
import { SaveSceneDto } from './dto/save-scene.dto';
import { Scene } from './entities/scene.entity';
import { ScenesService } from './scenes.service';

@Controller('scenes')
export class ScenesController {
  constructor(private readonly scenesService: ScenesService) {}

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
}
