import { ConsoleLogger } from '@nestjs/common';

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0');
}

/**
 * The stock logger stamps messages only to the second, which is too coarse to tell
 * apart the burst of requests a single scene push produces. This prints local time
 * as `YYYY-MM-DD HH:mm:ss.SSS`.
 */
export class MillisecondConsoleLogger extends ConsoleLogger {
  protected getTimestamp(): string {
    const now = new Date();
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    return `${date} ${time}.${pad(now.getMilliseconds(), 3)}`;
  }
}
