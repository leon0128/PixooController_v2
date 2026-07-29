'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { Loader2, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ApiError, api } from '@/lib/api';
import {
  DAY_LABELS,
  SLOTS_PER_DAY,
  slotToTime,
  type Scene,
  type ScheduleEntry,
  type ScheduleEntryPayload,
} from '@/lib/api-types';
import { cn } from '@/lib/utils';

/** One row per hour keeps the grid readable while cells stay 10 minutes wide. */
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const SLOTS_PER_HOUR = 6;

interface EditorState {
  /** The entry being edited, identified by where it currently sits. */
  original: { dayOfWeek: number; slot: number } | null;
  dayOfWeek: number;
  slot: number;
  sceneId: number | null;
}

/** Distinct colours so each scene is recognisable across the week at a glance. */
const SCENE_COLORS = [
  'bg-sky-200 hover:bg-sky-300',
  'bg-emerald-200 hover:bg-emerald-300',
  'bg-amber-200 hover:bg-amber-300',
  'bg-violet-200 hover:bg-violet-300',
  'bg-rose-200 hover:bg-rose-300',
  'bg-teal-200 hover:bg-teal-300',
];

export function ScheduleGrid({
  scenes,
  initialEntries,
}: {
  scenes: Scene[];
  initialEntries: ScheduleEntry[];
}) {
  const router = useRouter();
  const [entries, setEntries] = useState<ScheduleEntryPayload[]>(() =>
    initialEntries.map(({ dayOfWeek, slot, sceneId }) => ({ dayOfWeek, slot, sceneId })),
  );
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);

  const sceneById = useMemo(
    () => new Map(scenes.map((scene) => [scene.id, scene])),
    [scenes],
  );
  const colorOf = useCallback(
    (sceneId: number) => {
      const index = scenes.findIndex((scene) => scene.id === sceneId);
      return SCENE_COLORS[(index < 0 ? 0 : index) % SCENE_COLORS.length];
    },
    [scenes],
  );

  /** Which scene is playing in each slot, following the same wrapping rule as the API. */
  const activeByPosition = useMemo(() => {
    const total = 7 * SLOTS_PER_DAY;
    const result = new Array<number | null>(total).fill(null);
    if (entries.length === 0) return result;

    const sorted = [...entries].sort(
      (a, b) => a.dayOfWeek * SLOTS_PER_DAY + a.slot - (b.dayOfWeek * SLOTS_PER_DAY + b.slot),
    );
    // Start from the last marker of the week, which carries over into Sunday.
    let current = sorted[sorted.length - 1].sceneId;
    let next = 0;
    for (let position = 0; position < total; position++) {
      while (
        next < sorted.length &&
        sorted[next].dayOfWeek * SLOTS_PER_DAY + sorted[next].slot === position
      ) {
        current = sorted[next].sceneId;
        next++;
      }
      result[position] = current;
    }
    return result;
  }, [entries]);

  const startsAt = useMemo(() => {
    const map = new Map<number, ScheduleEntryPayload>();
    for (const entry of entries) {
      map.set(entry.dayOfWeek * SLOTS_PER_DAY + entry.slot, entry);
    }
    return map;
  }, [entries]);

  function openEditor(dayOfWeek: number, slot: number) {
    const existing = startsAt.get(dayOfWeek * SLOTS_PER_DAY + slot);
    setEditor({
      original: existing ? { dayOfWeek, slot } : null,
      dayOfWeek,
      slot,
      sceneId: existing?.sceneId ?? scenes[0]?.id ?? null,
    });
  }

  function applyEditor() {
    if (!editor || editor.sceneId === null) return;

    const withoutOriginal = entries.filter(
      (entry) =>
        !(
          editor.original &&
          entry.dayOfWeek === editor.original.dayOfWeek &&
          entry.slot === editor.original.slot
        ),
    );
    // Moving onto an occupied slot replaces what was there.
    const withoutTarget = withoutOriginal.filter(
      (entry) => !(entry.dayOfWeek === editor.dayOfWeek && entry.slot === editor.slot),
    );

    setEntries([
      ...withoutTarget,
      { dayOfWeek: editor.dayOfWeek, slot: editor.slot, sceneId: editor.sceneId },
    ]);
    setDirty(true);
    setEditor(null);
  }

  function removeEditorEntry() {
    if (!editor?.original) return;
    setEntries((current) =>
      current.filter(
        (entry) =>
          !(
            entry.dayOfWeek === editor.original!.dayOfWeek &&
            entry.slot === editor.original!.slot
          ),
      ),
    );
    setDirty(true);
    setEditor(null);
  }

  async function save() {
    setSaving(true);
    try {
      await api.replaceSchedules(entries);
      toast.success('Schedule saved');
      setDirty(false);
      router.refresh();
    } catch (cause) {
      toast.error(cause instanceof ApiError ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
          <p className="text-muted-foreground text-sm">
            Click a cell to place a scene’s start time. A scene runs until the next
            start time, and Saturday night carries over into Sunday.
          </p>
        </div>
        <Button disabled={saving || !dirty} onClick={() => void save()}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save
        </Button>
      </div>

      {scenes.length === 0 && (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            Create a scene first.
          </CardContent>
        </Card>
      )}

      {scenes.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {scenes.map((scene) => (
              <span key={scene.id} className="flex items-center gap-1.5">
                <span
                  className={cn('size-3 rounded-sm border', colorOf(scene.id).split(' ')[0])}
                />
                {scene.name}
              </span>
            ))}
          </div>

          <Card className="overflow-x-auto">
            <CardContent className="min-w-[720px] py-4">
              <div className="flex">
                <div className="w-12 shrink-0" />
                {DAY_LABELS.map((label) => (
                  <div
                    key={label}
                    className="flex-1 pb-1 text-center text-xs font-medium"
                  >
                    {label}
                  </div>
                ))}
              </div>

              {HOURS.map((hour) => (
                <div key={hour} className="flex items-stretch">
                  <div className="text-muted-foreground w-12 shrink-0 pr-2 text-right text-[10px] leading-4">
                    {String(hour).padStart(2, '0')}:00
                  </div>
                  {DAY_LABELS.map((_, day) => (
                    <div key={day} className="flex flex-1 gap-px px-px">
                      {Array.from({ length: SLOTS_PER_HOUR }, (_, i) => {
                        const slot = hour * SLOTS_PER_HOUR + i;
                        const position = day * SLOTS_PER_DAY + slot;
                        const activeId = activeByPosition[position];
                        const isStart = startsAt.has(position);
                        return (
                          <button
                            key={slot}
                            type="button"
                            aria-label={`${DAY_LABELS[day]} ${slotToTime(slot)}`}
                            title={`${DAY_LABELS[day]} ${slotToTime(slot)}${
                              activeId ? ` — ${sceneById.get(activeId)?.name ?? ''}` : ''
                            }`}
                            onClick={() => openEditor(day, slot)}
                            className={cn(
                              'h-4 flex-1 border-y border-transparent transition-colors',
                              activeId ? colorOf(activeId) : 'bg-muted hover:bg-muted-foreground/20',
                              isStart && 'border-foreground/70 border-l-2',
                            )}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>

          <p className="text-muted-foreground text-xs">
            Coloured spans are when that scene is playing; the line on the left edge marks
            a start time.
          </p>
        </>
      )}

      <Dialog open={editor !== null} onOpenChange={(open) => !open && setEditor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editor?.original ? 'Edit start time' : 'Add a start time'}
            </DialogTitle>
            <DialogDescription>
              The scene begins at this time and ends when the next one starts.
            </DialogDescription>
          </DialogHeader>

          {editor && (
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="editor-day">Day</Label>
                  <select
                    id="editor-day"
                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                    value={editor.dayOfWeek}
                    onChange={(event) =>
                      setEditor({ ...editor, dayOfWeek: Number(event.target.value) })
                    }
                  >
                    {DAY_LABELS.map((label, day) => (
                      <option key={day} value={day}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="editor-slot">Start time</Label>
                  <select
                    id="editor-slot"
                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                    value={editor.slot}
                    onChange={(event) =>
                      setEditor({ ...editor, slot: Number(event.target.value) })
                    }
                  >
                    {Array.from({ length: SLOTS_PER_DAY }, (_, slot) => (
                      <option key={slot} value={slot}>
                        {slotToTime(slot)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="editor-scene">Scene</Label>
                <select
                  id="editor-scene"
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  value={editor.sceneId ?? ''}
                  onChange={(event) =>
                    setEditor({ ...editor, sceneId: Number(event.target.value) })
                  }
                >
                  {scenes.map((scene) => (
                    <option key={scene.id} value={scene.id}>
                      {scene.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-between">
            {editor?.original ? (
              <Button variant="destructive" onClick={removeEditorEntry}>
                <Trash2 className="size-4" />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <Button onClick={applyEditor} disabled={editor?.sceneId === null}>
                Apply
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
