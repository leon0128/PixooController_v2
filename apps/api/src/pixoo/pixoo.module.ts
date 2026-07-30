import { Module } from '@nestjs/common';
import { PixooDeviceClient } from './pixoo-device.client';
import { PixooFontController } from './pixoo-font.controller';
import { PixooFontService } from './pixoo-font.service';
import { PixooService } from './pixoo.service';

@Module({
  controllers: [PixooFontController],
  providers: [PixooDeviceClient, PixooFontService, PixooService],
  exports: [PixooService],
})
export class PixooModule {}
