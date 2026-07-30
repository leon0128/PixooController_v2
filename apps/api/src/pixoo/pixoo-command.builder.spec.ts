import {
  buildClearCommandList,
  buildElementCommandList,
  buildImageCommandList,
  buildSceneRequests,
  PIXOO_ITEM_TYPES,
} from './pixoo-command.builder';
import {
  MAX_SCENE_ELEMENTS,
  SCENE_ELEMENT_TYPES,
} from '../scenes/entities/scene-element.entity';
import type {
  PixooCommand,
  PixooElementInput,
  PixooItem,
  PixooSceneInput,
} from './pixoo.types';

const element = (
  overrides: Partial<PixooElementInput> = {},
): PixooElementInput => ({
  type: 'hour_minute',
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

const entries = (command: PixooCommand) => command.CommandList as PixooCommand[];
const steps = (scene: PixooSceneInput) => buildSceneRequests(scene).map((r) => r.step);

describe('buildClearCommandList', () => {
  it('wipes both layers', () => {
    expect(buildClearCommandList()).toEqual([
      { Command: 'Draw/ClearHttpText' },
      { Command: 'Draw/ResetHttpGifId' },
    ]);
  });
});

describe('buildImageCommandList', () => {
  it('is empty when the scene has no background', () => {
    expect(buildImageCommandList(scene({ elements: [element()] }))).toEqual([]);
  });

  it('emits one SendHttpGif per frame, sharing PicNum and PicID', () => {
    const commands = buildImageCommandList(
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

  it('never carries text commands', () => {
    const commands = buildImageCommandList(
      scene({ image: { picSpeed: 100, frames: ['a'] }, elements: [element()] }),
    );
    expect(commands.every((c) => c.Command === 'Draw/SendHttpGif')).toBe(true);
  });
});

describe('buildElementCommandList', () => {
  it('is empty when the scene has no elements', () => {
    expect(
      buildElementCommandList(scene({ image: { picSpeed: 1, frames: ['a'] } })),
    ).toEqual([]);
  });

  it('never carries image commands', () => {
    const commands = buildElementCommandList(
      scene({ image: { picSpeed: 100, frames: ['a'] }, elements: [element()] }),
    );
    expect(commands.every((c) => c.Command === 'Draw/SendHttpItemList')).toBe(true);
  });

  it('puts every element into a single item list with sequential TextIds', () => {
    const commands = buildElementCommandList(
      scene({
        elements: [
          element({ type: 'hour_minute' }),
          element({ type: 'temperature' }),
          element({ type: 'weekday_medium' }),
        ],
      }),
    );
    const items = commands.find((c) => c.Command === 'Draw/SendHttpItemList')!
      .ItemList as PixooItem[];

    expect(items).toHaveLength(3);
    expect(items.map((i) => i.TextId)).toEqual([1, 2, 3]);
    expect(items.map((i) => i.type)).toEqual([5, 17, 14]);
  });

  it('maps each display type to its documented numeric code', () => {
    const items = buildElementCommandList(
      scene({
        elements: [
          element({ type: 'month' }),
          element({ type: 'day' }),
          element({ type: 'year' }),
          element({ type: 'weekday_long' }),
          element({ type: 'weather' }),
          element({ type: 'noise' }),
        ],
      }),
    )[0].ItemList as PixooItem[];

    expect(items.map((i) => i.type)).toEqual([9, 8, 7, 15, 20, 21]);
  });

  it('keeps each element independently positioned', () => {
    const commands = buildElementCommandList(
      scene({
        elements: [
          element({ type: 'month', x: 4, y: 4, textWidth: 8, textHeight: 6 }),
          element({ type: 'text', x: 12, y: 7, textWidth: 3, textHeight: 2 }),
        ],
      }),
    );
    const items = commands.find((c) => c.Command === 'Draw/SendHttpItemList')!
      .ItemList as PixooItem[];

    expect(items[0]).toMatchObject({ x: 4, y: 4, TextWidth: 8, Textheight: 6 });
    expect(items[1]).toMatchObject({ x: 12, y: 7, TextWidth: 3, Textheight: 2 });
  });

  it('renames the element fields to the casing the device expects', () => {
    const commands = buildElementCommandList(
      scene({ elements: [element({ textWidth: 60, textHeight: 20, updateTime: 360 })] }),
    );
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
      speed: 100,
      color: '#FFFFFF',
      update_time: 360,
      align: 1,
    });
  });

});

describe('buildSceneRequests', () => {
  it('clears, then sends the background, then the text', () => {
    const requests = buildSceneRequests(
      scene({ image: { picSpeed: 500, frames: ['a', 'b'] }, elements: [element()] }),
    );

    expect(requests.map((r) => r.step)).toEqual(['clear', 'image', 'elements']);
    expect(requests.every((r) => r.command.Command === 'Draw/CommandList')).toBe(true);

    const [clear, image, text] = requests;
    expect(entries(clear.command).map((c) => c.Command)).toEqual([
      'Draw/ClearHttpText',
      'Draw/ResetHttpGifId',
    ]);
    expect(entries(image.command).map((c) => c.Command)).toEqual([
      'Draw/SendHttpGif',
      'Draw/SendHttpGif',
    ]);
    expect(entries(text.command).map((c) => c.Command)).toEqual([
      'Draw/SendHttpItemList',
    ]);
  });

  it('skips the steps a scene has nothing for', () => {
    expect(steps(scene({ image: { picSpeed: 1, frames: ['a'] } }))).toEqual([
      'clear',
      'image',
    ]);
    expect(steps(scene({ elements: [element()] }))).toEqual(['clear', 'elements']);
    expect(steps(scene())).toEqual(['clear']);
  });

  it('never emits an empty CommandList', () => {
    for (const input of [
      scene(),
      scene({ image: { picSpeed: 1, frames: ['a'] } }),
      scene({ elements: [element()] }),
    ]) {
      for (const request of buildSceneRequests(input)) {
        expect(entries(request.command).length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the image payload out of the text request', () => {
    const requests = buildSceneRequests(
      scene({ image: { picSpeed: 500, frames: ['a'] }, elements: [element()] }),
    );
    const text = requests.find((r) => r.step === 'elements')!;
    expect(JSON.stringify(text.command)).not.toContain('PicData');
  });
});

describe('display type coverage', () => {
  it('maps every type the entity allows, with no duplicate codes', () => {
    const codes = SCENE_ELEMENT_TYPES.map((type) => PIXOO_ITEM_TYPES[type].type);

    expect(SCENE_ELEMENT_TYPES).toHaveLength(23);
    expect(codes).toEqual(Array.from({ length: 23 }, (_, i) => i + 1));
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('sends TextString only for the types that carry their own content', () => {
    for (const type of SCENE_ELEMENT_TYPES) {
      const bearsText = type === 'text' || type === 'url_text';
      const items = buildElementCommandList(
        scene({ elements: [element({ type, text: bearsText ? 'hello' : null })] }),
      )[0].ItemList as PixooItem[];

      expect(items[0].TextString).toBe(bearsText ? 'hello' : undefined);
    }
  });

  it('passes a url through unchanged for url_text', () => {
    const items = buildElementCommandList(
      scene({
        elements: [
          element({ type: 'url_text', text: 'http://example.com/d?a=1', updateTime: 60 }),
        ],
      }),
    )[0].ItemList as PixooItem[];

    expect(items[0]).toMatchObject({
      type: 23,
      TextString: 'http://example.com/d?a=1',
      update_time: 60,
    });
  });
});

describe('TextId assignment', () => {
  it('numbers items from 1 in element order', () => {
    const items = buildElementCommandList(
      scene({ elements: [element(), element(), element()] }),
    )[0].ItemList as PixooItem[];

    expect(items.map((i) => i.TextId)).toEqual([1, 2, 3]);
  });

  it('stays under the device limit at the maximum element count', () => {
    // The device requires TextId < 40, which is what caps a scene's element count.
    const items = buildElementCommandList(
      scene({ elements: Array.from({ length: MAX_SCENE_ELEMENTS }, () => element()) }),
    )[0].ItemList as PixooItem[];

    expect(items).toHaveLength(39);
    expect(Math.max(...items.map((i) => i.TextId))).toBeLessThan(40);
  });
});
