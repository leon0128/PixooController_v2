import { Body, Controller, Get, Put } from '@nestjs/common';
import { ReplaceSchedulesDto } from './dto/replace-schedules.dto';
import { Schedule } from './entities/schedule.entity';
import { SchedulesService } from './schedules.service';

@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  findAll(): Promise<Schedule[]> {
    return this.schedulesService.findAll();
  }

  @Put()
  replaceAll(@Body() dto: ReplaceSchedulesDto): Promise<Schedule[]> {
    return this.schedulesService.replaceAll(dto);
  }
}
