'use client';

import { useEffect, useRef } from 'react';
import { PIXOO_SIZE, drawPicData } from '@/lib/pic-data';
import { cn } from '@/lib/utils';

/**
 * Paints PicData onto a canvas.
 *
 * Drawing happens through a ref rather than by deriving a data URL into state:
 * the canvas is an external system to synchronise with, which is what effects are
 * for, and it avoids the extra render a setState would cause.
 */
export function PicCanvas({
  picData,
  className,
  style,
}: {
  picData: string | null;
  className?: string;
  style?: React.CSSProperties;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;

    if (picData) {
      drawPicData(context, picData);
    } else {
      context.clearRect(0, 0, PIXOO_SIZE, PIXOO_SIZE);
    }
  }, [picData]);

  return (
    <canvas
      ref={canvas}
      width={PIXOO_SIZE}
      height={PIXOO_SIZE}
      className={cn('[image-rendering:pixelated]', className)}
      style={style}
    />
  );
}
