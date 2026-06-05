import { ferrisError } from "./errors";
import type { CapturedScreen, ScreenInfo } from "./types";

export type MouseButton = "left" | "right" | "middle";
export type ActionStatus = "action" | "done" | "fail";
export type ActionKind =
  | { action: "click" | "double_click"; x: number; y: number; screenId?: string; button: MouseButton }
  | { action: "right_click" | "move_mouse"; x: number; y: number; screenId?: string }
  | { action: "drag"; fromX: number; fromY: number; toX: number; toY: number; screenId?: string; durationMs: number; button: MouseButton }
  | { action: "scroll"; x?: number; y?: number; screenId?: string; deltaX: number; deltaY: number }
  | { action: "type"; text: string }
  | { action: "press_key"; key: string }
  | { action: "hotkey"; keys: string[] }
  | { action: "wait"; durationMs: number };

export interface AgentAction {
  status: ActionStatus;
  kind?: ActionKind;
  waitAfterMs: number;
  reason?: string;
}

export function parseActionMarkdown(markdown: string): AgentAction {
  const trimmed = markdown.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) throw ferrisError("protocol_error", "FerrisGrid act expects compact Markdown key/value lines, not JSON");
  const fields = new Map<string, string>();
  for (const line of markdown.split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean || clean.startsWith("#")) continue;
    const index = clean.indexOf(":");
    if (index < 0) continue;
    fields.set(clean.slice(0, index).trim(), clean.slice(index + 1).trim());
  }

  const status = parseStatus(fields.get("status") ?? "action");
  const waitAfterMs = parseOptionalInteger(fields, "wait_after_ms") ?? 0;
  if (waitAfterMs > 30000) throw ferrisError("protocol_error", "wait_after_ms must be <= 30000");
  const reason = fields.get("reason");
  if (status !== "action") return { status, waitAfterMs, reason };

  const action = required(fields, "action");
  const screenId = fields.get("screen_id");
  switch (action) {
    case "click":
    case "double_click":
      return { status, waitAfterMs, reason, kind: { action, screenId, x: coord(fields, "x"), y: coord(fields, "y"), button: parseButton(fields.get("button") ?? "left") } };
    case "right_click":
    case "move_mouse":
      return { status, waitAfterMs, reason, kind: { action, screenId, x: coord(fields, "x"), y: coord(fields, "y") } };
    case "drag": {
      const durationMs = parseOptionalInteger(fields, "duration_ms") ?? 450;
      if (durationMs > 5000) throw ferrisError("protocol_error", "drag duration_ms must be <= 5000");
      return { status, waitAfterMs, reason, kind: { action, screenId, fromX: coord(fields, "from_x"), fromY: coord(fields, "from_y"), toX: coord(fields, "to_x"), toY: coord(fields, "to_y"), durationMs, button: parseButton(fields.get("button") ?? "left") } };
    }
    case "scroll": {
      const hasX = fields.has("x");
      const hasY = fields.has("y");
      if (hasX !== hasY) throw ferrisError("protocol_error", "scroll x and y must be supplied together");
      const deltaX = parseOptionalInteger(fields, "delta_x") ?? 0;
      const deltaY = intField(fields, "delta_y");
      if (Math.abs(deltaX) > 2000 || Math.abs(deltaY) > 2000) throw ferrisError("protocol_error", "scroll deltas must be <= 2000");
      return { status, waitAfterMs, reason, kind: { action, screenId, x: hasX ? coord(fields, "x") : undefined, y: hasY ? coord(fields, "y") : undefined, deltaX, deltaY } };
    }
    case "type": {
      const text = required(fields, "text");
      if (text.length > 500) throw ferrisError("protocol_error", "typed text must be <= 500 characters");
      return { status, waitAfterMs, reason, kind: { action, text } };
    }
    case "press_key": {
      const key = required(fields, "key");
      if (!key.trim()) throw ferrisError("protocol_error", "press_key key must not be empty");
      return { status, waitAfterMs, reason, kind: { action, key } };
    }
    case "hotkey": {
      const keys = required(fields, "keys").split("+").map((key) => key.trim()).filter(Boolean);
      if (keys.length === 0 || keys.length > 4) throw ferrisError("protocol_error", "hotkey must contain 1 to 4 keys");
      return { status, waitAfterMs, reason, kind: { action, keys } };
    }
    case "wait": {
      const durationMs = intField(fields, "duration_ms");
      if (durationMs > 30000) throw ferrisError("protocol_error", "wait duration_ms must be <= 30000");
      return { status, waitAfterMs, reason, kind: { action, durationMs } };
    }
    default:
      throw ferrisError("protocol_error", `unknown action: ${action}`);
  }
}

export function resolvePointerScreen(kind: ActionKind, screens: CapturedScreen[], defaultScreenId?: string): ScreenInfo | undefined {
  const requested = screenIdOf(kind) ?? defaultScreenId;
  if (requested === "primary") return screens.find((screen) => screen.screen.isPrimary)?.screen;
  if (requested) {
    const found = screens.find((screen) => screen.screen.screenId === requested);
    if (!found) throw ferrisError("coordinate_error", `unknown screen_id: ${requested}`);
    return found.screen;
  }
  if (requiresScreen(kind) && screens.length > 1) throw ferrisError("coordinate_error", "screen_id is required when multiple screens are available");
  if (requiresScreen(kind)) return screens[0]?.screen;
  return undefined;
}

export function actionSummary(kind: ActionKind, screen?: ScreenInfo, dryRun = false): string {
  const prefix = dryRun ? "dry_run " : "";
  switch (kind.action) {
    case "click":
    case "double_click":
      return `${prefix}${kind.action} x=${nativeX(screen, kind.x)} y=${nativeY(screen, kind.y)} button=${kind.button}`;
    case "right_click":
    case "move_mouse":
      return `${prefix}${kind.action} x=${nativeX(screen, kind.x)} y=${nativeY(screen, kind.y)}`;
    case "drag":
      return `${prefix}drag from_x=${nativeX(screen, kind.fromX)} from_y=${nativeY(screen, kind.fromY)} to_x=${nativeX(screen, kind.toX)} to_y=${nativeY(screen, kind.toY)} duration_ms=${kind.durationMs} button=${kind.button}`;
    case "scroll":
      return `${prefix}scroll delta_x=${kind.deltaX} delta_y=${kind.deltaY}`;
    case "type":
      return `${prefix}type text=<redacted>`;
    case "press_key":
      return `${prefix}press_key key=${kind.key}`;
    case "hotkey":
      return `${prefix}hotkey keys=${kind.keys.join("+")}`;
    case "wait":
      return `${prefix}wait duration_ms=${kind.durationMs}`;
  }
}

function nativeX(screen: ScreenInfo | undefined, x: number): number {
  if (!screen) return x;
  return screen.originX + Math.round((x / 1000) * screen.nativeWidth);
}

function nativeY(screen: ScreenInfo | undefined, y: number): number {
  if (!screen) return y;
  return screen.originY + Math.round((y / 1000) * screen.nativeHeight);
}

function screenIdOf(kind: ActionKind): string | undefined {
  return "screenId" in kind ? kind.screenId : undefined;
}

function requiresScreen(kind: ActionKind): boolean {
  if (["click", "double_click", "right_click", "move_mouse", "drag"].includes(kind.action)) return true;
  return kind.action === "scroll" && kind.x !== undefined;
}

function parseStatus(input: string): ActionStatus {
  if (input === "action" || input === "done" || input === "fail") return input;
  throw ferrisError("protocol_error", `unknown status: ${input}`);
}

function parseButton(input: string): MouseButton {
  if (input === "left" || input === "right" || input === "middle") return input;
  throw ferrisError("protocol_error", `unsupported mouse button: ${input}`);
}

function required(fields: Map<string, string>, key: string): string {
  const found = fields.get(key);
  if (found === undefined) throw ferrisError("protocol_error", `missing required field: ${key}`);
  return found;
}

function intField(fields: Map<string, string>, key: string): number {
  const value = Number(required(fields, key));
  if (!Number.isInteger(value)) throw ferrisError("protocol_error", `${key} must be an integer`);
  return value;
}

function parseOptionalInteger(fields: Map<string, string>, key: string): number | undefined {
  if (!fields.has(key)) return undefined;
  return intField(fields, key);
}

function coord(fields: Map<string, string>, key: string): number {
  const value = intField(fields, key);
  if (value < 0 || value > 1000) throw ferrisError("coordinate_error", `${key} must be in normalized range 0..1000`);
  return value;
}
