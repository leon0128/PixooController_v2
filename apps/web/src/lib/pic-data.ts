export const PIXOO_SIZE = 64;
export const PIC_DATA_BYTES = PIXOO_SIZE * PIXOO_SIZE * 3;

/**
 * The device wants a raw RGB buffer, not an image file: three bytes per pixel,
 * row by row, Base64-encoded. Converting here rather than server-side means the
 * API only ever handles the exact string it forwards to the device.
 */
function rgbToBase64(rgb: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < rgb.length; i++) {
    binary += String.fromCharCode(rgb[i]);
  }
  return btoa(binary);
}

function base64ToRgb(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Reads an image file into PicData. Rejects anything that is not exactly
 * 64x64 — the display is that size, and silently rescaling would wreck pixel art.
 */
export async function fileToPicData(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(`${file.name}: could not be read as an image`);
  });

  try {
    if (bitmap.width !== PIXOO_SIZE || bitmap.height !== PIXOO_SIZE) {
      throw new Error(
        `${file.name}: must be exactly ${PIXOO_SIZE}x${PIXOO_SIZE} (got ${bitmap.width}x${bitmap.height})`,
      );
    }

    const canvas = document.createElement('canvas');
    canvas.width = PIXOO_SIZE;
    canvas.height = PIXOO_SIZE;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Could not initialise a canvas context');

    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, PIXOO_SIZE, PIXOO_SIZE);

    // Drop the alpha channel; the device has no notion of transparency.
    const rgb = new Uint8Array(PIC_DATA_BYTES);
    for (let pixel = 0; pixel < PIXOO_SIZE * PIXOO_SIZE; pixel++) {
      rgb[pixel * 3] = data[pixel * 4];
      rgb[pixel * 3 + 1] = data[pixel * 4 + 1];
      rgb[pixel * 3 + 2] = data[pixel * 4 + 2];
    }
    return rgbToBase64(rgb);
  } finally {
    bitmap.close();
  }
}

/** Paints PicData onto a 64x64 canvas context. */
export function drawPicData(
  context: CanvasRenderingContext2D,
  picData: string,
): void {
  const rgb = base64ToRgb(picData);
  const image = context.createImageData(PIXOO_SIZE, PIXOO_SIZE);
  for (let pixel = 0; pixel < PIXOO_SIZE * PIXOO_SIZE; pixel++) {
    image.data[pixel * 4] = rgb[pixel * 3];
    image.data[pixel * 4 + 1] = rgb[pixel * 3 + 1];
    image.data[pixel * 4 + 2] = rgb[pixel * 3 + 2];
    image.data[pixel * 4 + 3] = 255;
  }
  context.putImageData(image, 0, 0);
}
