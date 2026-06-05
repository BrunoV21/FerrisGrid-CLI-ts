export type ImageFormat = "jpg" | "png";

export type ImageSizeLimit =
  | { kind: "native" }
  | { kind: "fixed"; edge: number }
  | { kind: "adaptive"; minLongEdge: number; minShortEdge: number };

export interface ScreenInfo {
  screenId: string;
  name: string;
  isPrimary: boolean;
  originX: number;
  originY: number;
  nativeWidth: number;
  nativeHeight: number;
  scaleFactor: number;
}

export interface CapturedScreen {
  screen: ScreenInfo;
  imageWidth: number;
  imageHeight: number;
  screenshotPath: string;
  metadataPath: string;
}

export interface ObserveResult {
  sessionDir: string;
  step: number;
  imageSizeLimit: ImageSizeLimit;
  screens: CapturedScreen[];
}

export interface ActResult {
  sessionDir: string;
  step: number;
  actionSummary: string;
  waitAfterMs: number;
  result: string;
  imageSizeLimit: ImageSizeLimit;
  screens: CapturedScreen[];
}

export interface ActionErrorResult {
  sessionDir?: string;
  errorType: string;
  reason: string;
  availableScreens: CapturedScreen[];
}

export interface DoctorReport {
  os: string;
  capture: string;
  input: string;
  outputDir: string;
  screens: ScreenInfo[];
  ffmpeg: string;
}
