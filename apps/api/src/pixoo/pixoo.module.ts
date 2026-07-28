import { Module } from '@nestjs/common';
import { PixooDeviceClient } from './pixoo-device.client';
import { PixooService } from './pixoo.service';

@Module({
  providers: [PixooDeviceClient, PixooService],
  exports: [PixooService],
})
export class PixooModule {}
