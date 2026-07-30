import { Controller, Get } from '@nestjs/common';
import { PixooFontService } from './pixoo-font.service';
import type { PixooFont } from './pixoo.types';

@Controller('fonts')
export class PixooFontController {
  constructor(private readonly fonts: PixooFontService) {}

  /** The fonts a scene element can be rendered in. Empty when Divoom is unreachable. */
  @Get()
  list(): Promise<PixooFont[]> {
    return this.fonts.list();
  }
}
