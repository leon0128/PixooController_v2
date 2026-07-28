import {
  ValidationArguments,
  ValidationOptions,
  registerDecorator,
} from 'class-validator';

export const PIXOO_SIZE = 64;
/** The device expects three bytes (R, G, B) per pixel, uncompressed. */
export const PIC_DATA_BYTES = PIXOO_SIZE * PIXOO_SIZE * 3;

/**
 * Validates a Pixoo `PicData` payload: Base64 of a raw 64x64 RGB buffer.
 * 12288 bytes is divisible by 3, so the encoding is exactly 16384 chars with no
 * padding — anything else is the wrong image size or the wrong format entirely.
 */
export function isPicData(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;

  const buffer = Buffer.from(value, 'base64');
  if (buffer.length !== PIC_DATA_BYTES) return false;

  // Buffer.from silently drops invalid characters, so confirm it round-trips.
  return buffer.toString('base64') === value;
}

export function IsPicData(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isPicData',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) => isPicData(value),
        defaultMessage: (args: ValidationArguments) =>
          `${args.property} must be Base64 of a raw ${PIXOO_SIZE}x${PIXOO_SIZE} RGB buffer (${PIC_DATA_BYTES} bytes)`,
      },
    });
  };
}
