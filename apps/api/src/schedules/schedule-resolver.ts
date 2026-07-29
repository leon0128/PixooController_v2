import { SLOTS_PER_DAY } from './entities/schedule.entity';

/** Just the fields resolution needs, so this stays testable without the database. */
export interface ScheduleMarker {
  dayOfWeek: number;
  slot: number;
  sceneId: number;
}

export const MINUTES_PER_SLOT = 24 * 60 / SLOTS_PER_DAY;

/** The 10-minute slot a wall-clock time falls in. */
export function slotOf(date: Date): number {
  return Math.floor((date.getHours() * 60 + date.getMinutes()) / MINUTES_PER_SLOT);
}

/** Position on the weekly timeline, 0 (Sunday 00:00) to 1007 (Saturday 23:50). */
function position(dayOfWeek: number, slot: number): number {
  return dayOfWeek * SLOTS_PER_DAY + slot;
}

/**
 * Finds the scene playing at `now`.
 *
 * Markers only record where a scene starts, so the active one is the most recent
 * marker at or before now. The week is a loop: when every marker lies in the
 * future, the one playing is the last of the week, carried over from Saturday
 * night into Sunday morning. That is what keeps playback from ever having a gap.
 *
 * Returns null only when there are no markers at all.
 */
export function resolveActiveMarker<T extends ScheduleMarker>(
  markers: readonly T[],
  now: Date,
): T | null {
  if (markers.length === 0) return null;

  const current = position(now.getDay(), slotOf(now));

  let started: T | null = null;
  let lastOfWeek: T = markers[0];

  for (const marker of markers) {
    const at = position(marker.dayOfWeek, marker.slot);

    if (at <= current && (started === null || at > position(started.dayOfWeek, started.slot))) {
      started = marker;
    }
    if (at > position(lastOfWeek.dayOfWeek, lastOfWeek.slot)) {
      lastOfWeek = marker;
    }
  }

  return started ?? lastOfWeek;
}
