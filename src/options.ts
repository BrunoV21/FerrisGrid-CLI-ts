import { ferrisError } from "./errors";
import type { ImageFormat, ImageSizeLimit } from "./types";

export const FAST_IMAGE_EDGE = 800;
export const BALANCED_MIN_LONG_EDGE = 800;
export const BALANCED_MIN_SHORT_EDGE = 500;
export const DETAIL_IMAGE_EDGE = 1920;

export interface SharedOptions {
  outputDir: string;
  session?: string;
  screenId?: string;
  format: ImageFormat;
  gridOverlay: boolean;
  imageSizeLimit: ImageSizeLimit;
  backend: string;
  dryRun: boolean;
  file?: string;
}

export interface DoctorOptions {
  outputDir: string;
  backend: string;
}

export interface RecapOptions {
  video?: "mp4";
  framerate: number;
}

export interface ClearOptions {
  outputDir: string;
  force: boolean;
}

export function parseSharedOptions(args: string[]): SharedOptions {
  const options: SharedOptions = {
    outputDir: process.env.FERRISGRID_OUTPUT_DIR ?? ".ferrisgrid",
    screenId: process.env.FERRISGRID_DEFAULT_SCREEN_ID,
    format: "jpg",
    gridOverlay: true,
    imageSizeLimit: process.env.FERRISGRID_MAX_IMAGE_EDGE
      ? parseMaxImageEdge(process.env.FERRISGRID_MAX_IMAGE_EDGE)
      : balancedImageSizeLimit(),
    backend: process.env.FERRISGRID_BACKEND ?? "native",
    dryRun: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    switch (flag) {
      case "--output-dir":
        options.outputDir = value(args, ++index, flag);
        break;
      case "--session":
        options.session = value(args, ++index, flag);
        break;
      case "--screen-id":
        options.screenId = value(args, ++index, flag);
        break;
      case "--format":
        options.format = parseImageFormat(value(args, ++index, flag));
        break;
      case "--grid-overlay":
        options.gridOverlay = parseBool(value(args, ++index, flag));
        break;
      case "--max-image-edge":
        options.imageSizeLimit = parseMaxImageEdge(value(args, ++index, flag));
        break;
      case "--resolution":
        options.imageSizeLimit = parseResolution(value(args, ++index, flag), flag);
        break;
      case "--no-downsample":
        options.imageSizeLimit = { kind: "native" };
        break;
      case "--backend":
        options.backend = value(args, ++index, flag);
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--file":
        options.file = value(args, ++index, flag);
        break;
      default:
        throw ferrisError("protocol_error", `unknown flag: ${flag}`);
    }
  }
  return options;
}

export function parseDoctorOptions(args: string[]): DoctorOptions {
  const options = {
    outputDir: process.env.FERRISGRID_OUTPUT_DIR ?? ".ferrisgrid",
    backend: process.env.FERRISGRID_BACKEND ?? "native",
  };
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === "--output-dir") options.outputDir = value(args, ++index, flag);
    else if (flag === "--backend") options.backend = value(args, ++index, flag);
    else throw ferrisError("protocol_error", `unknown doctor flag: ${flag}`);
  }
  return options;
}

export function parseRecapOptions(args: string[]): RecapOptions {
  const options: RecapOptions = { framerate: 2 };
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === "--video") {
      const video = value(args, ++index, flag);
      if (video !== "mp4") throw ferrisError("protocol_error", `unsupported video format: ${video}`);
      options.video = "mp4";
    } else if (flag === "--framerate" || flag === "--fps") {
      options.framerate = parseFramerate(value(args, ++index, flag));
    } else {
      throw ferrisError("protocol_error", `unknown recap flag: ${flag}`);
    }
  }
  return options;
}

export function parseClearOptions(args: string[]): ClearOptions {
  const options = { outputDir: process.env.FERRISGRID_OUTPUT_DIR ?? ".ferrisgrid", force: false };
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === "--output-dir") options.outputDir = value(args, ++index, flag);
    else if (flag === "--force") options.force = true;
    else throw ferrisError("protocol_error", `unknown clear flag: ${flag}`);
  }
  return options;
}

export function balancedImageSizeLimit(): ImageSizeLimit {
  return { kind: "adaptive", minLongEdge: BALANCED_MIN_LONG_EDGE, minShortEdge: BALANCED_MIN_SHORT_EDGE };
}

function value(args: string[], index: number, flag: string): string {
  const found = args[index];
  if (found === undefined) throw ferrisError("protocol_error", `${flag} requires a value`);
  return found;
}

function parseImageFormat(input: string): ImageFormat {
  if (input === "jpg" || input === "jpeg") return "jpg";
  if (input === "png") return "png";
  throw ferrisError("protocol_error", `unsupported image format: ${input}`);
}

function parseBool(input: string): boolean {
  if (["true", "1", "yes"].includes(input)) return true;
  if (["false", "0", "no"].includes(input)) return false;
  throw ferrisError("protocol_error", `expected boolean, got ${input}`);
}

function parseMaxImageEdge(input: string): ImageSizeLimit {
  if (["native", "none", "off", "0"].includes(input)) return { kind: "native" };
  const edge = Number(input);
  if (!Number.isInteger(edge)) throw ferrisError("protocol_error", `expected max image edge pixels or native, got ${input}`);
  if (edge < 320) throw ferrisError("protocol_error", "max image edge must be at least 320 pixels");
  return { kind: "fixed", edge };
}

function parseResolution(input: string, flag: string): ImageSizeLimit {
  if (input === "fast") return { kind: "fixed", edge: FAST_IMAGE_EDGE };
  if (input === "balanced") return balancedImageSizeLimit();
  if (input === "detail") return { kind: "fixed", edge: DETAIL_IMAGE_EDGE };
  if (input === "native") return { kind: "native" };
  try {
    return parseMaxImageEdge(input);
  } catch {
    throw ferrisError("protocol_error", `${flag} must be fast, balanced, detail, native, or a max image edge`);
  }
}

function parseFramerate(input: string): number {
  const framerate = Number(input);
  if (!Number.isInteger(framerate)) throw ferrisError("protocol_error", `expected framerate as a positive integer, got ${input}`);
  if (framerate === 0) throw ferrisError("protocol_error", "framerate must be greater than 0");
  return framerate;
}
