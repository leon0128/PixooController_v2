import { buildSceneCommands, PIXOO_ITEM_TYPES } from './pixoo-command.builder';
import type { PixooElementInput, PixooItem, PixooSceneInput } from './pixoo.types';

const element = (
  overrides: Partial<PixooElementInput> = {},
): PixooElementInput => ({
  type: 'time',
  x: 3,
  y: 10,
  dir: 0,
  font: 232,
  textWidth: 60,
  textHeight: 20,
  speed: 100,
  color: '#FFFFFF',
  updateTime: 3600,
  align: 1,
  ...overrides,
});

const scene = (overrides: Partial<PixooSceneInput> = {}): PixooSceneInput => ({
  image: null,
  elements: [],
  ...overrides,
});

describe('buildSceneCommands', () => {
  it('always clears the previous scene first', () => {
    const [first, second] = buildSceneCommands(scene());
    expect(first).toEqual({ Command: 'Draw/ClearHttpText' });
    expect(second).toEqual({ Command: 'Draw/ResetHttpGifId' });
  });

  it('emits nothing but the clears for an empty scene', () => {
    expect(buildSceneCommands(scene())).toHaveLength(2);
  });

  it('sends one SendHttpGif per frame, sharing PicNum and PicID', () => {
    const commands = buildSceneCommands(
      scene({ image: { picSpeed: 500, frames: ['a', 'b', 'c'] } }),
    );
    const gifs = commands.filter((c) => c.Command === 'Draw/SendHttpGif');

    expect(gifs).toHaveLength(3);
    expect(gifs.map((g) => g.PicOffset)).toEqual([0, 1, 2]);
    expect(gifs.map((g) => g.PicData)).toEqual(['a', 'b', 'c']);
    expect(gifs.every((g) => g.PicNum === 3)).toBe(true);
    expect(gifs.every((g) => g.PicID === 0)).toBe(true);
    expect(gifs.every((g) => g.PicWidth === 64)).toBe(true);
    expect(gifs.every((g) => g.PicSpeed === 500)).toBe(true);
  });

  it('omits the image commands when a scene has no background', () => {
    const commands = buildSceneCommands(scene({ elements: [element()] }));
    expect(commands.some((c) => c.Command === 'Draw/SendHttpGif')).toBe(false);
  });

  it('omits the item list when a scene has no elements', () => {
    const commands = buildSceneCommands(
      scene({ image: { picSpeed: 100, frames: ['a'] } }),
    );
    expect(commands.some((c) => c.Command === 'Draw/SendHttpItemList')).toBe(false);
  });

  it('puts every element into a single item list with sequential TextIds', () => {
    const commands = buildSceneCommands(
      scene({
        elements: [
          element({ type: 'time' }),
          element({ type: 'temperature' }),
          element({ type: 'day_of_week' }),
        ],
      }),
    );
    const list = commands.find((c) => c.Command === 'Draw/SendHttpItemList');
    const items = list!.ItemList as PixooItem[];

    expect(items).toHaveLength(3);
    expect(items.map((i) => i.TextId)).toEqual([1, 2, 3]);
    expect(items.map((i) => i.type)).toEqual([5, 17, 14]);
  });

  it('maps the three date parts to their own item types', () => {
    const commands = buildSceneCommands(
      scene({
        elements: [
          element({ type: 'date_month' }),
          element({ type: 'date_separator' }),
          element({ type: 'date_day' }),
        ],
      }),
    );
    const items = commands.find((c) => c.Command === 'Draw/SendHttpItemList')!
      .ItemList as PixooItem[];

    expect(items.map((i) => i.type)).toEqual([9, 22, 8]);
    expect(items.map((i) => i.TextString)).toEqual(['Month', ':', 'Date']);
  });

  it('keeps each element independently positioned', () => {
    const commands = buildSceneCommands(
      scene({
        elements: [
          element({ type: 'date_month', x: 4, y: 4, textWidth: 8, textHeight: 6 }),
          element({ type: 'date_separator', x: 12, y: 7, textWidth: 3, textHeight: 2 }),
        ],
      }),
    );
    const items = commands.find((c) => c.Command === 'Draw/SendHttpItemList')!
      .ItemList as PixooItem[];

    expect(items[0]).toMatchObject({ x: 4, y: 4, TextWidth: 8, Textheight: 6 });
    expect(items[1]).toMatchObject({ x: 12, y: 7, TextWidth: 3, Textheight: 2 });
  });

  it('renames the element fields to the casing the device expects', () => {
    const commands = buildSceneCommands({
      image: null,
      elements: [element({ textWidth: 60, textHeight: 20, updateTime: 360 })],
    });
    const item = (
      commands.find((c) => c.Command === 'Draw/SendHttpItemList')!.ItemList as PixooItem[]
    )[0];

    expect(item).toEqual({
      TextId: 1,
      type: 5,
      x: 3,
      y: 10,
      dir: 0,
      font: 232,
      TextWidth: 60,
      Textheight: 20,
      TextString: 'Clock',
      speed: 100,
      color: '#FFFFFF',
      update_time: 360,
      align: 1,
    });
  });

  it('orders the image before the text so text lands on top', () => {
    const commands = buildSceneCommands(
      scene({
        image: { picSpeed: 500, frames: ['a'] },
        elements: [element()],
      }),
    );
    expect(commands.map((c) => c.Command)).toEqual([
      'Draw/ClearHttpText',
      'Draw/ResetHttpGifId',
      'Draw/SendHttpGif',
      'Draw/SendHttpItemList',
    ]);
  });

  it('covers every element type the entity allows', () => {
    expect(Object.keys(PIXOO_ITEM_TYPES).sort()).toEqual([
      'date_day',
      'date_month',
      'date_separator',
      'day_of_week',
      'temperature',
      'time',
    ]);
  });
});
