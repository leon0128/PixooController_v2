import type { SceneElementType } from '../scenes/entities/scene-element.entity';
import { PIXOO_SIZE } from '../common/validators/is-pic-data.validator';
import type {
  PixooCommand,
  PixooElementInput,
  PixooItem,
  PixooSceneInput,
} from './pixoo.types';

/**
 * The numeric ItemList code for each display type.
 * http://doc.divoom-gz.com/web/#/12?page_id=234
 *
 * `needsFont` records which characters the chosen font has to cover, taken from
 * the same document — a font without letters cannot render a weekday, for example.
 */
export const PIXOO_ITEM_TYPES: Record<
  SceneElementType,
  { type: number; needsFont: string }
> = {
  second: { type: 1, needsFont: 'digits' },
  minute: { type: 2, needsFont: 'digits' },
  hour: { type: 3, needsFont: 'digits' },
  am_pm: { type: 4, needsFont: 'a, m, p' },
  hour_minute: { type: 5, needsFont: 'digits' },
  hour_minute_second: { type: 6, needsFont: 'digits' },
  year: { type: 7, needsFont: 'digits' },
  day: { type: 8, needsFont: 'digits' },
  month: { type: 9, needsFont: 'digits' },
  month_year: { type: 10, needsFont: 'digits' },
  english_month_day: { type: 11, needsFont: 'letters' },
  day_month_year: { type: 12, needsFont: 'digits' },
  weekday_short: { type: 13, needsFont: 'letters' },
  weekday_medium: { type: 14, needsFont: 'letters' },
  weekday_long: { type: 15, needsFont: 'letters' },
  english_month: { type: 16, needsFont: 'letters' },
  temperature: { type: 17, needsFont: 'digits, c, f' },
  temperature_max: { type: 18, needsFont: 'digits, c, f' },
  temperature_min: { type: 19, needsFont: 'digits, c, f' },
  weather: { type: 20, needsFont: 'letters' },
  noise: { type: 21, needsFont: 'digits' },
  text: { type: 22, needsFont: 'the characters used' },
  url_text: { type: 23, needsFont: 'the characters returned' },
};

/**
 * Reset first, so a previously pushed animation never keeps playing underneath.
 * PicID can then stay 0 for every scene.
 */
const PIC_ID = 0;

function toItem(element: PixooElementInput, textId: number): PixooItem {
  const { type } = PIXOO_ITEM_TYPES[element.type];
  const item: PixooItem = {
    TextId: textId,
    type,
    x: element.x,
    y: element.y,
    dir: element.dir,
    font: element.font,
    TextWidth: element.textWidth,
    Textheight: element.textHeight,
    speed: element.speed,
    color: element.color,
    update_time: element.updateTime,
    align: element.align,
  };

  // TextString is documented as optional and only carries meaning for the two types
  // whose content the device does not produce itself.
  if (element.text) item.TextString = element.text;

  return item;
}

/** Wipes both layers the previous scene left behind. */
export function buildClearCommandList(): PixooCommand[] {
  return [{ Command: 'Draw/ClearHttpText' }, { Command: 'Draw/ResetHttpGifId' }];
}

/**
 * The background frames. Each stays its own entry — the device reassembles the loop
 * from PicNum and PicOffset — but they all travel in the one request.
 */
export function buildImageCommandList(scene: PixooSceneInput): PixooCommand[] {
  if (!scene.image || scene.image.frames.length === 0) return [];

  const { picSpeed, frames } = scene.image;
  return frames.map((picData, index) => ({
    Command: 'Draw/SendHttpGif',
    PicNum: frames.length,
    PicWidth: PIXOO_SIZE,
    PicOffset: index,
    PicID: PIC_ID,
    PicSpeed: picSpeed,
    PicData: picData,
  }));
}

/** The text overlay, as a single item list. */
export function buildElementCommandList(scene: PixooSceneInput): PixooCommand[] {
  if (scene.elements.length === 0) return [];

  return [
    {
      Command: 'Draw/SendHttpItemList',
      ItemList: scene.elements.map((element, index) => toItem(element, index + 1)),
    },
  ];
}

/** One POST to the device, named so the debug log says which step it is. */
export interface PixooSceneRequest {
  step: 'clear' | 'image' | 'elements';
  command: PixooCommand;
}

/** Wraps commands into a `Draw/CommandList` body. */
function toCommandList(commands: PixooCommand[]): PixooCommand {
  return { Command: 'Draw/CommandList', CommandList: commands };
}

/**
 * The requests that push a scene, in order: clear both layers, send the background,
 * then send the text so it lands on top. Each is one batched `Draw/CommandList`.
 * http://doc.divoom-gz.com/web/#/12?page_id=241
 *
 * A step with nothing to send is left out — clearing is the clear step's job, so an
 * empty image or element list means no request rather than an empty one.
 */
export function buildSceneRequests(scene: PixooSceneInput): PixooSceneRequest[] {
  const requests: PixooSceneRequest[] = [
    { step: 'clear', command: toCommandList(buildClearCommandList()) },
  ];

  const image = buildImageCommandList(scene);
  if (image.length > 0) {
    requests.push({ step: 'image', command: toCommandList(image) });
  }

  const elements = buildElementCommandList(scene);
  if (elements.length > 0) {
    requests.push({ step: 'elements', command: toCommandList(elements) });
  }

  return requests;
}
