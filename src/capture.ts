import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";
import { ferrisError } from "./errors";
import type { CapturedScreen, ImageFormat, ImageSizeLimit, ScreenInfo } from "./types";

export function listScreens(backend: string): ScreenInfo[] {
  if (backendByName(backend) === "fake") return fakeScreens();
  if (process.platform === "linux") return [];
  return [];
}

export function captureScreens(params: {
  backend: string;
  frameDir: string;
  format: ImageFormat;
  screenId?: string;
  imageSizeLimit: ImageSizeLimit;
}): CapturedScreen[] {
  const backend = backendByName(params.backend);
  if (backend !== "fake") {
    if (backend === "native-linux-x11" && process.platform !== "linux") {
      throw ferrisError("platform_error", "native Linux X11 capture is only available on Linux; use --backend native on this OS or --backend fake");
    }
    if (backend === "native-macos" && process.platform !== "darwin") {
      throw ferrisError("platform_error", "native backend is currently implemented for macOS only; use --backend fake for local protocol tests");
    }
    throw ferrisError("platform_error", "native TypeScript capture is unavailable; use --backend fake or --use-rust-binary");
  }

  fs.mkdirSync(params.frameDir, { recursive: true });
  const selected = selectScreens(fakeScreens(), params.screenId);
  return selected.map((screen) => {
    const [imageWidth, imageHeight] = scaledDimensions(screen.nativeWidth, screen.nativeHeight, params.imageSizeLimit);
    const screenshotPath = path.join(params.frameDir, `${screen.screenId}.${params.format}`);
    fs.writeFileSync(screenshotPath, png(imageWidth, imageHeight));
    const metadataPath = writeMetadata(params.frameDir, screen, screenshotPath, imageWidth, imageHeight);
    return { screen, imageWidth, imageHeight, screenshotPath, metadataPath };
  });
}

export function backendByName(name: string): "fake" | "native-macos" | "native-linux-x11" {
  if (name === "fake") return "fake";
  if (["linux", "x11", "native-linux", "native-linux-x11"].includes(name)) return "native-linux-x11";
  if (["macos", "native-macos"].includes(name)) return "native-macos";
  if (process.platform === "linux") return "native-linux-x11";
  return "native-macos";
}

export function imageSizeDescription(limit: ImageSizeLimit): string {
  if (limit.kind === "native") return "native";
  if (limit.kind === "fixed") return String(limit.edge);
  return `adaptive min_long_edge=${limit.minLongEdge} min_short_edge=${limit.minShortEdge}`;
}

function fakeScreens(): ScreenInfo[] {
  return [
    { screenId: "screen-1", name: "Fake Primary", isPrimary: true, originX: 0, originY: 0, nativeWidth: 3024, nativeHeight: 1964, scaleFactor: 2.0 },
    { screenId: "screen-2", name: "Fake Secondary", isPrimary: false, originX: 3024, originY: 0, nativeWidth: 2560, nativeHeight: 1440, scaleFactor: 1.0 },
  ];
}

function selectScreens(screens: ScreenInfo[], screenId: string | undefined): ScreenInfo[] {
  if (!screenId) return screens;
  const selected = screens.filter((screen) => screen.screenId === screenId);
  if (selected.length === 0) throw ferrisError("coordinate_error", `unknown screen_id: ${screenId}`);
  return selected;
}

export function scaledDimensions(width: number, height: number, imageSizeLimit: ImageSizeLimit): [number, number] {
  width = Math.max(1, width);
  height = Math.max(1, height);
  const maxEdge = targetMaxEdge(width, height, imageSizeLimit);
  if (maxEdge === undefined) return [width, height];
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return [width, height];
  const scale = maxEdge / longest;
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}

function targetMaxEdge(width: number, height: number, limit: ImageSizeLimit): number | undefined {
  if (limit.kind === "native") return undefined;
  if (limit.kind === "fixed") return Math.max(1, limit.edge);
  const longest = Math.max(width, height);
  const shortest = Math.min(width, height);
  const shortSideCap = Math.ceil((longest * Math.max(1, limit.minShortEdge)) / shortest);
  return Math.min(longest, Math.max(Math.max(1, limit.minLongEdge), shortSideCap));
}

function writeMetadata(frameDir: string, screen: ScreenInfo, screenshotPath: string, imageWidth: number, imageHeight: number): string {
  const metadataPath = path.join(frameDir, `${screen.screenId}.meta.md`);
  fs.writeFileSync(metadataPath, `## Screen Metadata\n- screen_id: ${screen.screenId}\n- name: ${screen.name}\n- coordinate_mode: normalized-1000\n- coordinate_range: x=0..1000 y=0..1000\n- coordinate_origin: top_left\n- coordinate_scope: screen_local\n- image_mapping: image_x=round(x/1000*(image_width-1)) image_y=round(y/1000*(image_height-1))\n- native_mapping: native_x=origin_x+round(x/1000*native_width) native_y=origin_y+round(y/1000*native_height)\n- origin_x: ${screen.originX}\n- origin_y: ${screen.originY}\n- native_width: ${screen.nativeWidth}\n- native_height: ${screen.nativeHeight}\n- image_width: ${imageWidth}\n- image_height: ${imageHeight}\n- scale_factor: ${screen.scaleFactor}\n- is_primary: ${screen.isPrimary}\n- screenshot: ${screenshotPath}\n`);
  return metadataPath;
}

function png(width: number, height: number): Buffer {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = row + 1 + x * 4;
      const shade = (x + y) % 255;
      raw[offset] = shade;
      raw[offset + 1] = 80;
      raw[offset + 2] = 180;
      raw[offset + 3] = 255;
    }
  }
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", ihdr(width, height)), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

function ihdr(width: number, height: number): Buffer {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;
  data[9] = 6;
  return data;
}

function chunk(type: string, data: Buffer): Buffer {
  const name = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
