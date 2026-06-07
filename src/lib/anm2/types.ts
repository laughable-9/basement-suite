// Parsed anm2 data model. Values are post-clamping: parsers normalize
// the corpus landmines (negative uint-wrapped crops, missing <Info>, FPS
// outliers, etc.) so consumers never see them.

export interface Anm2 {
  info: { fps: number; version: number; createdBy: string; createdOn: string };
  content: {
    spritesheets: Spritesheet[];
    layers: Layer[];
    nulls: NullDef[];
    events: EventDef[];
  };
  defaultAnimation: string;
  animations: Anm2Animation[];
}

export interface Spritesheet {
  id: number;
  /** Raw path as written in the XML (mixed case/separators preserved) */
  rawPath: string;
}

export interface Layer {
  id: number;
  name: string;
  spritesheetId: number;
  blendMode: "normal" | "additive";
}

export interface NullDef {
  id: number;
  name: string;
  showRect: boolean;
}

export interface EventDef {
  id: number;
  name: string;
}

export interface Anm2Animation {
  name: string;
  /** Timeline length in ticks; 0 is legal ("Empty" in 005.100_collectible) */
  frameNum: number;
  loop: boolean;
  rootFrames: TransformFrame[];
  /** IN DECLARATION ORDER = z-order, bottom first (NOT layer id order) */
  layers: LayerTrack[];
  nulls: NullTrack[];
  triggers: { eventId: number; atFrame: number }[];
}

export interface LayerTrack {
  layerId: number;
  visible: boolean;
  frames: LayerFrame[];
}

export interface NullTrack {
  nullId: number;
  visible: boolean;
  frames: TransformFrame[];
}

/** Root/Null keyframe — transform + tint only */
export interface TransformFrame {
  x: number;
  y: number;
  /** Percent; 100 = 1×; negative = mirror flip */
  xScale: number;
  yScale: number;
  /** Degrees */
  rotation: number;
  /** Ticks this keyframe holds (≥0; 0 occurs in game data) */
  delay: number;
  visible: boolean;
  /** Lerp toward the next keyframe across this one's delay */
  interpolated: boolean;
  /** 0–255 multipliers (clamped at parse) */
  tint: Rgba;
  /** −255–255 additive (clamped at parse) */
  offset: Rgb;
}

/** Layer keyframe — adds spritesheet source rect + pivot */
export interface LayerFrame extends TransformFrame {
  xCrop: number;
  yCrop: number;
  width: number;
  height: number;
  xPivot: number;
  yPivot: number;
}

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}
