import { resolveActiveMarker, slotOf } from './schedule-resolver';
import type { ScheduleMarker } from './schedule-resolver';

const marker = (dayOfWeek: number, slot: number, sceneId: number): ScheduleMarker => ({
  dayOfWeek,
  slot,
  sceneId,
});

/** Local-time date for a given weekday and time. 2026-07-26 is a Sunday. */
const at = (dayOfWeek: number, hours: number, minutes = 0) =>
  new Date(2026, 6, 26 + dayOfWeek, hours, minutes);

describe('slotOf', () => {
  it.each([
    [0, 0, 0],
    [0, 9, 0],
    [0, 10, 1],
    [1, 0, 6],
    [12, 0, 72],
    [23, 50, 143],
    [23, 59, 143],
  ])('maps %i:%i to slot %i', (hours, minutes, expected) => {
    expect(slotOf(new Date(2026, 6, 26, hours, minutes))).toBe(expected);
  });
});

describe('resolveActiveMarker', () => {
  it('returns null when nothing is scheduled', () => {
    expect(resolveActiveMarker([], at(0, 12))).toBeNull();
  });

  it('picks the marker that started most recently', () => {
    const markers = [marker(1, 0, 10), marker(1, 48, 20), marker(1, 96, 30)];
    // Monday 09:00 is slot 54, after 08:00 (slot 48) but before 16:00 (slot 96).
    expect(resolveActiveMarker(markers, at(1, 9))?.sceneId).toBe(20);
  });

  it('treats a marker as active from its exact slot', () => {
    const markers = [marker(1, 0, 10), marker(1, 48, 20)];
    expect(resolveActiveMarker(markers, at(1, 8, 0))?.sceneId).toBe(20);
    expect(resolveActiveMarker(markers, at(1, 7, 59))?.sceneId).toBe(10);
  });

  it('carries a scene across midnight into the next day', () => {
    const markers = [marker(1, 132, 10), marker(2, 48, 20)];
    // Monday 22:00 starts scene 10; Tuesday 03:00 is still before Tuesday 08:00.
    expect(resolveActiveMarker(markers, at(2, 3))?.sceneId).toBe(10);
  });

  it('wraps from Saturday night back into Sunday morning', () => {
    const markers = [marker(6, 138, 99), marker(3, 0, 50)];
    // Sunday 02:00 precedes every marker, so the last of the week is still playing.
    expect(resolveActiveMarker(markers, at(0, 2))?.sceneId).toBe(99);
  });

  it('never returns null when at least one marker exists', () => {
    const markers = [marker(4, 71, 7)];
    for (let day = 0; day <= 6; day++) {
      for (let hour = 0; hour < 24; hour++) {
        expect(resolveActiveMarker(markers, at(day, hour))?.sceneId).toBe(7);
      }
    }
  });

  it('covers every slot of the week with no gaps', () => {
    const markers = [
      marker(0, 0, 1),
      marker(2, 60, 2),
      marker(4, 100, 3),
      marker(6, 143, 4),
    ];
    for (let day = 0; day <= 6; day++) {
      for (let slot = 0; slot < 144; slot++) {
        const now = at(day, Math.floor(slot / 6), (slot % 6) * 10);
        expect(resolveActiveMarker(markers, now)).not.toBeNull();
      }
    }
  });

  it('is unaffected by the order markers arrive in', () => {
    const ordered = [marker(1, 0, 10), marker(1, 48, 20), marker(1, 96, 30)];
    const shuffled = [ordered[2], ordered[0], ordered[1]];
    expect(resolveActiveMarker(shuffled, at(1, 9))?.sceneId).toBe(
      resolveActiveMarker(ordered, at(1, 9))?.sceneId,
    );
  });
});
