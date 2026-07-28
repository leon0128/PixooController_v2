import type { SceneElementType } from '../scenes/entities/scene-element.entity';
import { PIXOO_SIZE } from '../common/validators/is-pic-data.validator';
import type {
  PixooCommand,
  PixooElementInput,
  PixooItem,
  PixooSceneInput,
} from './pixoo.types';

/**
 * Numeric ItemList type codes, confirmed against the device with Postman. The
 * device supplies the value itself for every one of these, so TextString only has
 * to be the placeholder the verified requests used.
 */
export const PIXOO_ITEM_TYPES: Record<
  SceneElementType,
  { type: number; textString: string }
> = {
  date_month: { type: 9, textString: 'Month' },
  date_separator: { type: 22, textString: ':' },
  date_day: { type: 8, textString: 'Date' },
  day_of_week: { type: 14, textString: 'Week' },
  time: { type: 5, textString: 'Clock' },
  temperature: { type: 17, textString: 'Temperature' },
};

/**
 * Reset first, so a previously pushed animation never keeps playing underneath.
 * PicID can then stay 0 for every scene.
 */
const PIC_ID = 0;

function toItem(element: PixooElementInput, textId: number): PixooItem {
  const { type, textString } = PIXOO_ITEM_TYPES[element.type];
  return {
    TextId: textId,
    type,
    x: element.x,
    y: element.y,
    dir: element.dir,
    font: element.font,
    TextWidth: element.textWidth,
    Textheight: element.textHeight,
    TextString: textString,
    speed: element.speed,
    color: element.color,
    update_time: element.updateTime,
    align: element.align,
  };
}

/**
 * Turns a scene into the ordered list of request bodies to POST at the device.
 *
 * Each animation frame is its own request: the device assembles them from PicNum
 * and PicOffset, which is why a multi-frame loop cannot be sent in one call.
 */
export function buildSceneCommands(scene: PixooSceneInput): PixooCommand[] {
  const commands: PixooCommand[] = [
    // Clear whatever the previous scene left behind.
    { Command: 'Draw/ClearHttpText' },
    { Command: 'Draw/ResetHttpGifId' },
  ];

  if (scene.image && scene.image.frames.length > 0) {
    const picNum = scene.image.frames.length;
    scene.image.frames.forEach((picData, index) => {
      commands.push({
        Command: 'Draw/SendHttpGif',
        PicNum: picNum,
        PicWidth: PIXOO_SIZE,
        PicOffset: index,
        PicID: PIC_ID,
        PicSpeed: scene.image!.picSpeed,
        PicData: picData,
      });
    });
  }

  if (scene.elements.length > 0) {
    commands.push({
      Command: 'Draw/SendHttpItemList',
      ItemList: scene.elements.map((element, index) => toItem(element, index + 1)),
    });
  }

  return commands;
}
