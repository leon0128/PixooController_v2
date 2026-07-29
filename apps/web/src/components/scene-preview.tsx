'use client';

import { PicCanvas } from '@/components/pic-canvas';
import { PIXOO_SIZE } from '@/lib/pic-data';
import { SCENE_ELEMENT_LABELS, type SceneElementType } from '@/lib/api-types';
import { cn } from '@/lib/utils';

export interface PreviewElement {
  type: SceneElementType;
  x: number;
  y: number;
  textWidth: number;
  textHeight: number;
  color: string;
}

/**
 * A magnified 64x64 stand-in for the display.
 *
 * The background is exact, but the text is drawn as labelled boxes: the device
 * renders it with its own bitmap fonts and fills in the live values, neither of
 * which can be reproduced here. It is for placement, not for appearance — use
 * "Preview on device" to see the real thing.
 */
export function ScenePreview({
  frames,
  frameIndex,
  elements,
  selectedIndex,
  scale = 5,
}: {
  frames: string[];
  frameIndex: number;
  elements: PreviewElement[];
  selectedIndex?: number | null;
  scale?: number;
}) {
  const frame = frames[frameIndex] ?? null;
  const size = PIXOO_SIZE * scale;

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-md border bg-black"
      style={{ width: size, height: size }}
    >
      <PicCanvas
        picData={frame}
        className="absolute inset-0"
        style={{ width: size, height: size }}
      />

      {elements.map((element, index) => (
        <div
          key={index}
          className={cn(
            'absolute flex items-center justify-center overflow-hidden border text-[9px] leading-none whitespace-nowrap',
            selectedIndex === index
              ? 'border-sky-400 bg-sky-400/25'
              : 'border-white/50 bg-white/10',
          )}
          style={{
            left: element.x * scale,
            top: element.y * scale,
            width: Math.max(element.textWidth, 1) * scale,
            height: Math.max(element.textHeight, 1) * scale,
            color: element.color,
          }}
          title={`${SCENE_ELEMENT_LABELS[element.type]} (${element.x}, ${element.y})`}
        >
          <span className="drop-shadow-[0_0_2px_rgba(0,0,0,0.9)]">
            {SCENE_ELEMENT_LABELS[element.type]}
          </span>
        </div>
      ))}
    </div>
  );
}
