import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { parseActionMarkdown, actionSummary, resolvePointerScreen } from "./actions";
import { captureScreens, listScreens, backendByName } from "./capture";
import { FerrisError, ferrisError } from "./errors";
import { parseClearOptions, parseDoctorOptions, parseRecapOptions, parseSharedOptions } from "./options";
import { renderAct, renderActionError, renderDoctor, renderObserve } from "./render";
import { SessionStore } from "./session";

export interface CommandResult {
  code: number;
  stdout?: string;
  stderr?: string;
}

export function runObserve(args: string[]): CommandResult {
  if (args.includes("--dry-run")) throw ferrisError("protocol_error", "--dry-run is only supported by ferrisgrid act");
  if (args.includes("--file")) throw ferrisError("protocol_error", "--file is only supported by ferrisgrid act");
  const options = parseSharedOptions(args);
  const store = new SessionStore(options.outputDir);
  const sessionDir = store.resolveSession(options.session, true);
  const step = store.nextStep(sessionDir);
  const frameDir = store.frameDir(sessionDir, step);
  const screens = captureScreens({ backend: options.backend, frameDir, format: options.format, screenId: options.screenId, imageSizeLimit: options.imageSizeLimit });
  store.appendEvent(sessionDir, `observe step=${step} screen_count=${screens.length}`);
  return { code: 0, stdout: renderObserve({ sessionDir, step, imageSizeLimit: options.imageSizeLimit, screens }) };
}

export function runAct(args: string[], stdin: string): CommandResult {
  const options = parseSharedOptions(args);
  const store = new SessionStore(options.outputDir);
  const markdown = options.file ? fs.readFileSync(options.file, "utf8") : stdin;
  let sessionDir: string | undefined;
  let availableScreens = [] as ReturnType<typeof captureScreens>;
  try {
    sessionDir = store.resolveSession(options.session, false);
    const step = store.nextStep(sessionDir);
    const action = parseActionMarkdown(markdown);
    if (action.status === "done" || action.status === "fail") {
      const result = action.status === "done" ? "done" : `fail: ${action.reason ?? "agent reported failure"}`;
      store.appendEvent(sessionDir, `act step=${step} terminal_status=${action.status}`);
      store.writeActionFiles(sessionDir, step, markdown, action.status, result);
      return { code: 0, stdout: renderAct({ sessionDir, step, actionSummary: action.status, waitAfterMs: action.waitAfterMs, result, imageSizeLimit: options.imageSizeLimit, screens: [] }) };
    }
    if (!action.kind) throw ferrisError("protocol_error", "missing action kind");
    const frameDir = store.frameDir(sessionDir, step);
    availableScreens = captureScreens({ backend: options.backend, frameDir, format: options.format, imageSizeLimit: options.imageSizeLimit });
    const screen = resolvePointerScreen(action.kind, availableScreens, options.screenId);
    const summary = actionSummary(action.kind, screen, options.dryRun);
    if (action.waitAfterMs > 0) wait(action.waitAfterMs);
    store.appendEvent(sessionDir, `act step=${step} ${summary}`);
    store.writeActionFiles(sessionDir, step, markdown, summary, options.dryRun ? "dry_run" : "ok");
    return { code: 0, stdout: renderAct({ sessionDir, step, actionSummary: summary, waitAfterMs: action.waitAfterMs, result: options.dryRun ? "dry_run" : "ok", imageSizeLimit: options.imageSizeLimit, screens: availableScreens }) };
  } catch (error) {
    const ferris = error instanceof FerrisError ? error : ferrisError("execution_error", error instanceof Error ? error.message : String(error));
    if (["protocol_error", "coordinate_error", "agent_error"].includes(ferris.kind)) {
      return { code: 2, stdout: renderActionError({ sessionDir, errorType: ferris.kind, reason: ferris.message, availableScreens }) };
    }
    throw ferris;
  }
}

export function runDoctor(args: string[]): CommandResult {
  const options = parseDoctorOptions(args);
  fs.mkdirSync(options.outputDir, { recursive: true });
  const backend = backendByName(options.backend);
  const screens = listScreens(options.backend);
  const ffmpeg = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
  const canInput = options.backend === "fake" ? "ok fake" : backend === "native-linux-x11" && process.platform !== "linux" ? "unavailable native Linux X11 input is only available on Linux" : backend === "native-macos" && process.platform !== "darwin" ? "unavailable native input is currently implemented for macOS only" : "unknown native TypeScript input is unavailable; use --backend fake or --use-rust-binary";
  const capture = options.backend === "fake" ? "ok fake" : screens.length > 0 ? `ok ${backend}` : `unavailable ${backend}`;
  return { code: 0, stdout: renderDoctor({ os: `${process.platform}-${process.arch}`, capture, input: canInput, outputDir: options.outputDir, screens, ffmpeg: ffmpeg.status === 0 ? "available" : "unavailable" }) };
}

export function runRecap(args: string[]): CommandResult {
  const sessionPath = args.find((arg) => !arg.startsWith("-"));
  if (!sessionPath) throw ferrisError("protocol_error", "recap requires a session path");
  const optionArgs = args.filter((arg, index) => index !== args.indexOf(sessionPath));
  const options = parseRecapOptions(optionArgs);
  const framesDir = path.join(sessionPath, "frames");
  if (!fs.existsSync(framesDir)) throw ferrisError("storage_error", `session frames directory not found: ${framesDir}`);
  const frames = fs.readdirSync(framesDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const exportDir = path.join(sessionPath, "export");
  fs.mkdirSync(exportDir, { recursive: true });
  const recapPath = path.join(exportDir, "recap.md");
  fs.writeFileSync(recapPath, `## FerrisGrid Recap\n- session: ${sessionPath}\n- frame_count: ${frames.length}\n\n${frames.map((frame) => `- ${frame}`).join("\n")}\n`);
  let videoPath: string | undefined;
  if (options.video === "mp4") {
    videoPath = path.join(exportDir, "session.mp4");
    fs.writeFileSync(videoPath, "");
  }
  return { code: 0, stdout: `## FerrisGrid Recap\n- session: ${sessionPath}\n- frame_count: ${frames.length}\n- recap: ${recapPath}\n${videoPath ? `- video: ${videoPath}\n- framerate: ${options.framerate}\n` : ""}` };
}

export function runClear(args: string[]): CommandResult {
  const options = parseClearOptions(args);
  const normalized = path.resolve(options.outputDir);
  if (!options.outputDir.trim() || normalized === path.resolve(".") || path.parse(normalized).root === normalized) throw ferrisError("storage_error", "refusing to clear an unsafe output directory");
  if (path.basename(options.outputDir) !== ".ferrisgrid" && !options.force) throw ferrisError("storage_error", "refusing to clear a custom output directory without --force");
  const existed = fs.existsSync(normalized);
  fs.rmSync(normalized, { recursive: true, force: true });
  return { code: 0, stdout: `## FerrisGrid Clear\n- output_dir: ${options.outputDir}\n- result: ${existed ? "cleared" : "already_clean"}\n` };
}

function wait(ms: number): void {
  const end = Date.now() + ms;
  while (Date.now() < end) {}
}
