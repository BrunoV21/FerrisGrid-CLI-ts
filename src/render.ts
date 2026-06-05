import type { ActionErrorResult, ActResult, CapturedScreen, DoctorReport, ObserveResult } from "./types";
import { imageSizeDescription } from "./capture";
import { FerrisError } from "./errors";

export function renderObserve(result: ObserveResult): string {
  return `## FerrisGrid Observation\n- session: ${result.sessionDir}\n- step: ${result.step}\n- coordinate_mode: normalized-1000\n- coordinate_range: x=0..1000 y=0..1000\n- coordinate_origin: top_left\n- image_size_limit: ${imageSizeDescription(result.imageSizeLimit)}\n- screen_count: ${result.screens.length}\n\n${renderScreens(result.screens)}`;
}

export function renderAct(result: ActResult): string {
  return `## FerrisGrid Action Result\n- session: ${result.sessionDir}\n- step: ${result.step}\n- action: ${result.actionSummary}\n- wait_after_ms: ${result.waitAfterMs}\n- result: ${result.result}\n- coordinate_mode: normalized-1000\n- image_size_limit: ${imageSizeDescription(result.imageSizeLimit)}\n- screen_count: ${result.screens.length}\n\n${renderScreens(result.screens)}`;
}

export function renderActionError(result: ActionErrorResult): string {
  return `## FerrisGrid Action Error\n- session: ${result.sessionDir ?? "unknown"}\n- error_type: ${result.errorType}\n- reason: ${result.reason}\n- available_screen_count: ${result.availableScreens.length}\n\n${renderScreens(result.availableScreens)}`;
}

export function renderDoctor(report: DoctorReport): string {
  const screens = report.screens.map((screen) => `### ${screen.screenId}\n- name: ${screen.name}\n- is_primary: ${screen.isPrimary}\n- origin_x: ${screen.originX}\n- origin_y: ${screen.originY}\n- native_width: ${screen.nativeWidth}\n- native_height: ${screen.nativeHeight}\n- scale_factor: ${screen.scaleFactor}`).join("\n\n");
  return `## FerrisGrid Doctor\n- os: ${report.os}\n- capture: ${report.capture}\n- input: ${report.input}\n- output_dir: ${report.outputDir}\n- ffmpeg: ${report.ffmpeg}\n- screen_count: ${report.screens.length}\n\n${screens}\n`;
}

export function renderError(error: unknown): string {
  const ferris = error instanceof FerrisError ? error : new FerrisError("execution_error", error instanceof Error ? error.message : String(error));
  return `## FerrisGrid Error\n- error_type: ${ferris.kind}\n- reason: ${ferris.message}\n`;
}

function renderScreens(screens: CapturedScreen[]): string {
  return screens.map((screen) => `### ${screen.screen.screenId}\n- name: ${screen.screen.name}\n- is_primary: ${screen.screen.isPrimary}\n- screenshot: ${screen.screenshotPath}\n- metadata: ${screen.metadataPath}\n- image_width: ${screen.imageWidth}\n- image_height: ${screen.imageHeight}\n- native_width: ${screen.screen.nativeWidth}\n- native_height: ${screen.screen.nativeHeight}\n- origin_x: ${screen.screen.originX}\n- origin_y: ${screen.screen.originY}\n- coordinate_mapping: image_x=round(x/1000*(image_width-1)) image_y=round(y/1000*(image_height-1))`).join("\n\n") + "\n";
}
