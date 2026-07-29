/** Mirrors the API's scene element types. */
export const SCENE_ELEMENT_TYPES = [
  'date_month',
  'date_separator',
  'date_day',
  'day_of_week',
  'time',
  'temperature',
] as const;

export type SceneElementType = (typeof SCENE_ELEMENT_TYPES)[number];

export const SCENE_ELEMENT_LABELS: Record<SceneElementType, string> = {
  date_month: 'Month',
  date_separator: 'Separator',
  date_day: 'Day',
  day_of_week: 'Weekday',
  time: 'Time',
  temperature: 'Temperature',
};

export interface SceneElement {
  id: number;
  type: SceneElementType;
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

export interface SceneImageDetail {
  id: number;
  frameIndex: number;
  imageData: string;
}

export interface SceneImage {
  id: number;
  picSpeed: number;
  details: SceneImageDetail[];
}

export interface Scene {
  id: number;
  name: string;
  image: SceneImage | null;
  elements: SceneElement[];
  createdAt: string;
  updatedAt: string;
}

/** Request shape for creating or replacing a scene. */
export interface SceneContentPayload {
  image: { picSpeed: number; frames: string[] } | null;
  elements: Omit<SceneElement, 'id'>[];
}

export interface SaveScenePayload extends SceneContentPayload {
  name: string;
}

export interface ScheduleEntry {
  id: number;
  dayOfWeek: number;
  slot: number;
  sceneId: number;
}

export interface ScheduleEntryPayload {
  dayOfWeek: number;
  slot: number;
  sceneId: number;
}

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const SLOTS_PER_DAY = 144;
export const MINUTES_PER_SLOT = 10;

/** "22:00" for slot 132. */
export function slotToTime(slot: number): string {
  const minutes = slot * MINUTES_PER_SLOT;
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}
