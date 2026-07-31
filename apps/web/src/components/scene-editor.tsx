'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import {
  ArrowLeft,
  Loader2,
  Monitor,
  Plus,
  Save,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FontField } from '@/components/font-field';
import { FrameThumbnail } from '@/components/frame-thumbnail';
import { ScenePreview } from '@/components/scene-preview';
import { ApiError, api } from '@/lib/api';
import {
  bearsText,
  SCENE_ELEMENT_GROUPS,
  MAX_SCENE_ELEMENTS,
  SCENE_ELEMENT_LABELS,
  SCROLL_DIRECTIONS,
  TEXT_ALIGNMENTS,
  type PixooFont,
  type SaveScenePayload,
  type Scene,
  type SceneElement,
  type SceneElementType,
} from '@/lib/api-types';
import { fileToPicData } from '@/lib/pic-data';
import { cn } from '@/lib/utils';

interface DraftElement {
  type: SceneElementType;
  text: string | null;
  x: number;
  y: number;
  dir: number;
  font: number;
  textWidth: number;
  textHeight: number;
  speed: number;
  color: string;
  updateTime: number;
  align: number;
}

/** Starting geometry, taken from the requests that were verified against the device. */
const ELEMENT_DEFAULTS: Partial<Record<SceneElementType, Partial<DraftElement>>> = {
  month: { x: 4, y: 4, font: 18, textWidth: 8, textHeight: 6 },
  day: { x: 14, y: 4, font: 18, textWidth: 8, textHeight: 6 },
  weekday_medium: { x: 24, y: 4, font: 18, textWidth: 15, textHeight: 10 },
  temperature: { x: 48, y: 4, font: 18, textWidth: 20, textHeight: 10, updateTime: 360 },
  hour_minute: { x: 3, y: 10, font: 232, textWidth: 60, textHeight: 20 },
  // A URL is polled rather than pushed, so it needs a sane refresh interval.
  url_text: { textWidth: 64, textHeight: 16, updateTime: 60 },
};

function toDraftElement(element: SceneElement): DraftElement {
  return {
    type: element.type,
    text: element.text,
    x: element.x,
    y: element.y,
    dir: element.dir,
    font: element.font,
    textWidth: element.textWidth,
    textHeight: element.textHeight,
    speed: element.speed,
    color: element.color,
    updateTime: element.updateTime,
    align: element.align,
  };
}

function newElement(type: SceneElementType): DraftElement {
  return {
    type,
    text: bearsText(type) ? '' : null,
    x: 0,
    y: 0,
    dir: 0,
    font: 18,
    textWidth: 16,
    textHeight: 8,
    speed: 100,
    color: '#FFFFFF',
    updateTime: 3600,
    align: 1,
    ...ELEMENT_DEFAULTS[type],
  };
}

export function SceneEditor({ scene, fonts }: { scene?: Scene; fonts: PixooFont[] }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const sceneId = scene?.id;

  const [name, setName] = useState(scene?.name ?? '');
  const [picSpeed, setPicSpeed] = useState(scene?.image?.picSpeed ?? 500);
  const [frames, setFrames] = useState<string[]>(() =>
    [...(scene?.image?.details ?? [])]
      .sort((a, b) => a.frameIndex - b.frameIndex)
      .map((detail) => detail.imageData),
  );
  // Picked field by field rather than spreading: the API also returns sceneId and
  // timestamps, which its whitelist rejects on the way back.
  const [elements, setElements] = useState<DraftElement[]>(
    () => scene?.elements.map(toDraftElement) ?? [],
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [previewFrame, setPreviewFrame] = useState(0);
  const [thumbnailFrame, setThumbnailFrame] = useState(
    scene?.image?.thumbnailFrameIndex ?? 0,
  );

  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  // Clamped during render rather than corrected in an effect, so removing frames
  // never leaves a dangling index even for one paint.
  const activeFrame = Math.min(previewFrame, Math.max(frames.length - 1, 0));
  const activeThumbnail = Math.min(thumbnailFrame, Math.max(frames.length - 1, 0));

  const buildPayload = useCallback((): SaveScenePayload => ({
    name: name.trim(),
    image:
      frames.length > 0
        ? { picSpeed, thumbnailFrameIndex: activeThumbnail, frames }
        : null,
    elements,
  }), [name, frames, picSpeed, activeThumbnail, elements]);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const added: string[] = [];
    for (const file of Array.from(files)) {
      try {
        added.push(await fileToPicData(file));
      } catch (cause) {
        toast.error((cause as Error).message);
      }
    }
    if (added.length > 0) setFrames((current) => [...current, ...added]);
    if (fileInput.current) fileInput.current.value = '';
  }

  function updateElement(index: number, patch: Partial<DraftElement>) {
    setElements((current) =>
      current.map((element, i) => (i === index ? { ...element, ...patch } : element)),
    );
  }

  async function save() {
    if (!name.trim()) {
      toast.error('Enter a scene name');
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (sceneId === undefined) {
        const created = await api.createScene(payload);
        toast.success('Scene created');
        router.push(`/scenes/${created.id}`);
      } else {
        await api.replaceScene(sceneId, payload);
        toast.success('Scene saved');
      }
    } catch (cause) {
      toast.error(cause instanceof ApiError ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  async function previewOnDevice() {
    setPreviewing(true);
    try {
      // The preview endpoint takes content only; a stray name is rejected.
      const { image, elements: previewElements } = buildPayload();
      await api.previewScene({ image, elements: previewElements });
      toast.success('Preview sent to the device');
    } catch (cause) {
      toast.error(cause instanceof ApiError ? cause.message : String(cause));
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back to the list"
          nativeButton={false}
          render={<Link href="/scenes" />}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="flex-1 text-2xl font-semibold tracking-tight">
          {sceneId === undefined ? 'New scene' : 'Edit scene'}
        </h1>
        <Button
          variant="outline"
          disabled={previewing}
          onClick={() => void previewOnDevice()}
        >
          {previewing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Monitor className="size-4" />
          )}
          Preview on device
        </Button>
        <Button disabled={saving} onClick={() => void save()}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <div className="space-y-3">
          <ScenePreview
            frames={frames}
            frameIndex={activeFrame}
            elements={elements}
            selectedIndex={selected}
          />
          {frames.length > 1 && (
            // A fixed eight columns rather than flex-wrap: the preview sits in an
            // auto-sized grid column, and a row of buttons free to grow sideways
            // widens it and squeezes the form beside it.
            <div className="grid grid-cols-8 gap-1">
              {frames.map((_, index) => (
                <Button
                  key={index}
                  size="xs"
                  className="px-0"
                  variant={index === activeFrame ? 'default' : 'outline'}
                  onClick={() => setPreviewFrame(index)}
                >
                  {index + 1}
                </Button>
              ))}
            </div>
          )}
          <p className="text-muted-foreground max-w-[320px] text-xs">
            The boxes show where each element sits. Fonts and live values cannot be
            reproduced here, so check the real appearance with “Preview on device”.
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="scene-name">Name</Label>
                <Input
                  id="scene-name"
                  value={name}
                  maxLength={255}
                  placeholder="Morning"
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Background</CardTitle>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => void addFiles(event.target.files)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInput.current?.click()}
                >
                  <Upload className="size-4" />
                  Add images
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {frames.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  This scene has no background. Add 64x64 images to loop them in order.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {frames.map((frame, index) => (
                      <div key={index} className="group relative">
                        <button
                          type="button"
                          onClick={() => setPreviewFrame(index)}
                          aria-label={`Show frame ${index + 1}`}
                        >
                          <FrameThumbnail
                            picData={frame}
                            className={cn(
                              'size-16',
                              index === activeFrame && 'ring-primary ring-2',
                            )}
                          />
                        </button>
                        <span className="bg-background/80 absolute bottom-0 left-0 rounded-tr px-1 text-[10px]">
                          {index + 1}
                        </span>
                        <button
                          type="button"
                          aria-label={
                            index === activeThumbnail
                              ? `Frame ${index + 1} is the thumbnail`
                              : `Use frame ${index + 1} as the thumbnail`
                          }
                          aria-pressed={index === activeThumbnail}
                          title="Use as thumbnail"
                          className={cn(
                            'bg-background/80 absolute right-0 bottom-0 rounded-tl px-1 transition-opacity',
                            index === activeThumbnail
                              ? 'opacity-100'
                              : 'opacity-0 group-hover:opacity-100',
                          )}
                          onClick={() => setThumbnailFrame(index)}
                        >
                          <Star
                            className={cn(
                              'size-3',
                              index === activeThumbnail && 'fill-current',
                            )}
                          />
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove frame ${index + 1}`}
                          className="bg-background absolute -top-1.5 -right-1.5 rounded-full border p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={() =>
                            setFrames((current) => current.filter((_, i) => i !== index))
                          }
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <p className="text-muted-foreground text-xs">
                    The starred frame represents this scene in the list; hover a frame
                    to change it.
                  </p>

                  <div className="space-y-1.5">
                    <Label htmlFor="pic-speed">Loop interval (ms)</Label>
                    <Input
                      id="pic-speed"
                      type="number"
                      min={0}
                      className="w-40"
                      value={picSpeed}
                      onChange={(event) => setPicSpeed(Number(event.target.value))}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Elements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 23 display types is too many for a row of buttons, so they are
                  grouped and picked from a list that adds on selection. */}
              <div className="flex items-center gap-2">
                <Plus className="text-muted-foreground size-4 shrink-0" />
                <select
                  aria-label="Add an element"
                  disabled={elements.length >= MAX_SCENE_ELEMENTS}
                  className="border-input bg-background h-9 flex-1 rounded-md border px-2 text-sm disabled:opacity-50"
                  value=""
                  onChange={(event) => {
                    const type = event.target.value as SceneElementType;
                    if (!type) return;
                    setSelected(elements.length);
                    setElements((current) => [...current, newElement(type)]);
                    event.target.value = '';
                  }}
                >
                  <option value="">Add an element…</option>
                  {SCENE_ELEMENT_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.types.map((entry) => (
                        <option key={entry.type} value={entry.type}>
                          {entry.label} — {entry.example}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {elements.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  No elements yet. Add one from the list above.
                </p>
              )}

              <div className="space-y-3">
                {elements.map((element, index) => (
                  <div
                    key={index}
                    className={cn(
                      'rounded-lg border p-3 transition-colors',
                      selected === index && 'border-primary bg-muted/40',
                    )}
                    onFocusCapture={() => setSelected(index)}
                    onMouseEnter={() => setSelected(index)}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {SCENE_ELEMENT_LABELS[element.type]}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove this element"
                        onClick={() =>
                          setElements((current) => current.filter((_, i) => i !== index))
                        }
                      >
                        <Trash2 className="text-destructive size-4" />
                      </Button>
                    </div>

                    {bearsText(element.type) && (
                      <div className="mb-3 space-y-1.5">
                        <Label className="text-xs">
                          {element.type === 'url_text' ? 'URL' : 'Text'}
                        </Label>
                        <Input
                          value={element.text ?? ''}
                          maxLength={512}
                          placeholder={
                            element.type === 'url_text'
                              ? 'http://example.com/value'
                              : 'Text to display'
                          }
                          onChange={(event) =>
                            updateElement(index, { text: event.target.value })
                          }
                        />
                        {element.type === 'url_text' && (
                          <p className="text-muted-foreground text-xs">
                            Polled every “Update interval” seconds. The response must be
                            JSON with a <code>DispData</code> string.
                          </p>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <NumberField
                        label="X"
                        value={element.x}
                        min={0}
                        max={63}
                        onChange={(x) => updateElement(index, { x })}
                      />
                      <NumberField
                        label="Y"
                        value={element.y}
                        min={0}
                        max={63}
                        onChange={(y) => updateElement(index, { y })}
                      />
                      <NumberField
                        label="Width"
                        value={element.textWidth}
                        min={1}
                        max={64}
                        onChange={(textWidth) => updateElement(index, { textWidth })}
                      />
                      <NumberField
                        label="Height"
                        value={element.textHeight}
                        min={1}
                        max={64}
                        onChange={(textHeight) => updateElement(index, { textHeight })}
                      />
                      <FontField
                        value={element.font}
                        fonts={fonts}
                        onChange={(font) => updateElement(index, { font })}
                        // A font is described by its charset, which needs the
                        // whole row to stay readable.
                        className="col-span-2 sm:col-span-4"
                      />
                      <NumberField
                        label="Update interval (s)"
                        value={element.updateTime}
                        min={0}
                        onChange={(updateTime) => updateElement(index, { updateTime })}
                      />
                      <NumberField
                        label="Scroll speed (ms)"
                        value={element.speed}
                        min={0}
                        onChange={(speed) => updateElement(index, { speed })}
                      />
                      <div className="space-y-1.5">
                        <Label className="text-xs">Scroll direction</Label>
                        <select
                          aria-label="Scroll direction"
                          className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                          value={element.dir}
                          onChange={(event) =>
                            updateElement(index, { dir: Number(event.target.value) })
                          }
                        >
                          {SCROLL_DIRECTIONS.map((direction) => (
                            <option key={direction.value} value={direction.value}>
                              {direction.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Align</Label>
                        <select
                          aria-label="Align"
                          className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                          value={element.align}
                          onChange={(event) =>
                            updateElement(index, { align: Number(event.target.value) })
                          }
                        >
                          {TEXT_ALIGNMENTS.map((alignment) => (
                            <option key={alignment.value} value={alignment.value}>
                              {alignment.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Color</Label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            aria-label="Color"
                            className="size-8 shrink-0 cursor-pointer rounded border bg-transparent"
                            value={element.color}
                            onChange={(event) =>
                              updateElement(index, {
                                color: event.target.value.toUpperCase(),
                              })
                            }
                          />
                          <Input
                            value={element.color}
                            className="font-mono"
                            onChange={(event) =>
                              updateElement(index, {
                                color: event.target.value.toUpperCase(),
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}
