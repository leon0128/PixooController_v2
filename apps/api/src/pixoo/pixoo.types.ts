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
  TextString: string;
  speed: number;
  color: string;
  update_time: number;
  align: number;
}

export interface DiscoveredDevice {
  DeviceName: string;
  DeviceId: number;
  DevicePrivateIP: string;
  DeviceMac: string;
}
