import { Injectable } from '@nestjs/common';
import { PixooDeviceClient } from './pixoo-device.client';
import type { PixooFont } from './pixoo.types';

/** The catalogue is static, so a hit lasts an hour rather than a request. */
const CACHE_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class PixooFontService {
  private cached: { fonts: PixooFont[]; at: number } | null = null;

  constructor(private readonly client: PixooDeviceClient) {}

  async list(): Promise<PixooFont[]> {
    if (this.cached && Date.now() - this.cached.at < CACHE_TTL_MS) {
      return this.cached.fonts;
    }

    const fonts = await this.client.fetchFonts();
    // An empty result means the catalogue was unreachable, so it is not cached —
    // the next request should try again rather than serve nothing for an hour.
    if (fonts.length > 0) {
      this.cached = { fonts, at: Date.now() };
    }
    return fonts;
  }
}
