/** Mirrors the API's scene element types. */
/**
 * Every display type Draw/SendHttpItemList supports, grouped the way the editor
 * offers them. http://doc.divoom-gz.com/web/#/12?page_id=234
 */
export const SCENE_ELEMENT_GROUPS = [
  {
    label: 'Time',
    types: [
      { type: 'hour_minute', label: 'Hour:Minute', example: '13:51' },
      { type: 'hour_minute_second', label: 'Hour:Minute:Second', example: '13:51:56' },
      { type: 'hour', label: 'Hour', example: '13' },
      { type: 'minute', label: 'Minute', example: '51' },
      { type: 'second', label: 'Second', example: '56' },
      { type: 'am_pm', label: 'AM / PM', example: 'PM' },
    ],
  },
  {
    label: 'Date',
    types: [
      { type: 'year', label: 'Year', example: '2026' },
      { type: 'month', label: 'Month', example: '01' },
      { type: 'day', label: 'Day', example: '22' },
      { type: 'month_year', label: 'Month-Year', example: '01-2026' },
      { type: 'day_month_year', label: 'Day:Month:Year', example: '22:01:2026' },
      { type: 'english_month', label: 'Month (JAN)', example: 'JAN' },
      { type: 'english_month_day', label: 'Month.Day (English)', example: 'JAN.22' },
    ],
  },
  {
    label: 'Weekday',
    types: [
      { type: 'weekday_short', label: 'Weekday (SU)', example: 'SU' },
      { type: 'weekday_medium', label: 'Weekday (SUN)', example: 'SUN' },
      { type: 'weekday_long', label: 'Weekday (SUNDAY)', example: 'SUNDAY' },
    ],
  },
  {
    label: 'Sensors',
    types: [
      { type: 'temperature', label: 'Temperature', example: '24c' },
      { type: 'temperature_max', label: 'Max temperature', example: '28c' },
      { type: 'temperature_min', label: 'Min temperature', example: '18c' },
      { type: 'weather', label: 'Weather', example: 'Sunny' },
      { type: 'noise', label: 'Noise level', example: '42' },
    ],
  },
  {
    label: 'Custom',
    types: [
      { type: 'text', label: 'Text', example: 'your own text' },
      { type: 'url_text', label: 'Text from URL', example: 'polled from a URL' },
    ],
  },
] as const;

export const SCENE_ELEMENT_TYPES = SCENE_ELEMENT_GROUPS.flatMap((group) =>
  group.types.map((entry) => entry.type),
);

export type SceneElementType = (typeof SCENE_ELEMENT_GROUPS)[number]['types'][number]['type'];

export const SCENE_ELEMENT_LABELS = Object.fromEntries(
  SCENE_ELEMENT_GROUPS.flatMap((group) =>
    group.types.map((entry) => [entry.type, entry.label]),
  ),
) as Record<SceneElementType, string>;

/** The two types whose content comes from the element rather than the device. */
export const TEXT_BEARING_TYPES: SceneElementType[] = ['text', 'url_text'];

/**
 * TextId is assigned from an element's position and the device requires it to stay
 * below 40, which caps how many elements a scene can hold.
 */
export const MAX_SCENE_ELEMENTS = 39;

/** The display is 64x64, so no text area can be larger. */
export const PIXOO_SIZE = 64;

/** Horizontal text alignment, as the device numbers it. */
export const TEXT_ALIGNMENTS = [
  { value: 1, label: 'Left' },
  { value: 2, label: 'Middle' },
  { value: 3, label: 'Right' },
] as const;

/** Which way text travels when it is too wide for its area. */
export const SCROLL_DIRECTIONS = [
  { value: 0, label: 'Scroll left' },
  { value: 1, label: 'Scroll right' },
] as const;

export function bearsText(type: SceneElementType): boolean {
  return TEXT_BEARING_TYPES.includes(type);
}

export interface SceneElement {
  id: number;
  type: SceneElementType;
  /** Sent as TextString; only the text and url_text types use it. */
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

export interface SceneImageDetail {
  id: number;
  frameIndex: number;
  imageData: string;
}

export interface SceneImage {
  id: number;
  picSpeed: number;
  /** Which frame stands in for the scene in listings. */
  thumbnailFrameIndex: number;
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
  image: { picSpeed: number; thumbnailFrameIndex: number; frames: string[] } | null;
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

/** A font the device can render text in, from Divoom's catalogue. */
export interface PixooFont {
  id: number;
  type: number;
  width: number;
  height: number;
  charset: string;
}

/**
 * "#232 · 11x20 · 0123456789:" — Divoom's catalogue has no font names, so the size
 * and the characters it can actually render are what identify one.
 */
export function fontLabel(font: PixooFont): string {
  const parts = [`#${font.id}`, `${font.width}x${font.height}`];
  if (font.charset) {
    parts.push(
      font.charset.length > 48 ? `${font.charset.slice(0, 48)}…` : font.charset,
    );
  } else {
    parts.push('image font');
  }
  return parts.join(' · ');
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
