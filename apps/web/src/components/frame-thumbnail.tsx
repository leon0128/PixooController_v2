'use client';

import { PicCanvas } from '@/components/pic-canvas';
import { cn } from '@/lib/utils';

export function FrameThumbnail({
  picData,
  className,
}: {
  picData: string;
  className?: string;
}) {
  return (
    <PicCanvas
      picData={picData}
      className={cn('bg-muted block rounded-sm border', className)}
    />
  );
}
