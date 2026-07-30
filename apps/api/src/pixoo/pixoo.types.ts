import type { SceneElementType } from '../scenes/entities/scene-element.entity';

/** The scene content the device needs, decoupled from how it was stored or sent. */
export interface PixooSceneInput {
  image: PixooImageInput | null;
  elements: PixooElementInput[];
}

export interface PixooImageInput {
  picSpeed: number;
  /** Base64 PicData, already in loop order. */
  frames: string[];
}

export interface PixooElementInput {
  type: SceneElementType;
  /** Sent as TextString; only the `text` and `url_text` types use it. */
  text?: string | null;
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

/** A single JSON body POSTed to `http://{ip}/post`. */
export type PixooCommand = Record<string, unknown> & { Command: string };

export interface PixooItem {
  TextId: number;
  type: number;
  x: number;
  y: number;
  dir: number;
  font: number;
  TextWidth: number;
  Textheight: number;
  TextString?: string;
  speed: number;
  color: string;
  update_time: number;
  align: number;
}

/**
 * A font the device can render text in. Divoom's catalogue has no names for these,
 * so the size and the supported characters are all there is to tell them apart.
 */
export interface PixooFont {
  id: number;
  /** Divoom's own classification. 0 are image fonts with no charset, 1 carry one. */
  type: number;
  width: number;
  height: number;
  /** The characters the font can render; empty for type 0. */
  charset: string;
}

export interface DiscoveredDevice {
  DeviceName: string;
  DeviceId: number;
  DevicePrivateIP: string;
  DeviceMac: string;
}
