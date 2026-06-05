import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, test } from "node:test";

import { dispatch } from "../src/cli";
import { packageName } from "../src/index";
import { FerrisError } from "../src/errors";
import { splitRustFallbackFlag } from "../src/rustFallback";

const tempRoots: string[] = [];

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ferrisgrid-ts-"));
  tempRoots.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempRoots.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

test("exports package name", () => {
  assert.equal(packageName, "ferrisgrid-cli");
});

test("root help and command help match documented command surface", () => {
  const root = dispatch([]);
  assert.equal(root.code, 0);
  assert.match(root.stdout ?? "", /FerrisGrid/);
  assert.match(root.stdout ?? "", /ferrisgrid observe \[options\]/);
  assert.match(root.stdout ?? "", /ferrisgrid act \[options\]/);

  const act = dispatch(["act", "--help"]);
  assert.equal(act.code, 0);
  assert.match(act.stdout ?? "", /FerrisGrid act/);
  assert.match(act.stdout ?? "", /--file <path>/);
});

test("version prints the Rust CLI package version", () => {
  const result = dispatch(["--version"]);
  assert.equal(result.code, 0);
  assert.equal(result.stdout, "ferrisgrid 0.2.0\n");
});

test("observe with fake backend creates session traces and metadata", () => {
  const outputDir = tempDir();
  const result = dispatch(["observe", "--backend", "fake", "--output-dir", outputDir, "--session", "oracle", "--resolution", "fast"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout ?? "", /## FerrisGrid Observation/);
  assert.match(result.stdout ?? "", /- screen_count: 2/);
  assert.match(result.stdout ?? "", /- image_width: 800/);
  assert.ok(fs.existsSync(path.join(outputDir, "config.toml")));
  assert.ok(fs.existsSync(path.join(outputDir, "sessions", "oracle", "manifest.md")));
  assert.ok(fs.existsSync(path.join(outputDir, "sessions", "oracle", "frames", "000001", "screen-1.jpg")));
  assert.ok(fs.existsSync(path.join(outputDir, "sessions", "oracle", "frames", "000001", "screen-1.meta.md")));
});

test("act parses compact Markdown, uses default screen id, and returns dry-run result", () => {
  const outputDir = tempDir();
  dispatch(["observe", "--backend", "fake", "--output-dir", outputDir, "--session", "oracle"]);
  const result = dispatch(
    ["act", "--backend", "fake", "--output-dir", outputDir, "--session", "oracle", "--screen-id", "screen-1", "--dry-run"],
    "status: action\naction: click\nx: 500\ny: 500\n",
  );
  assert.equal(result.code, 0);
  assert.match(result.stdout ?? "", /## FerrisGrid Action Result/);
  assert.match(result.stdout ?? "", /dry_run click x=1512 y=982 button=left/);
  assert.match(result.stdout ?? "", /- result: dry_run/);
});

test("act rejects JSON as an action error with exit code 2", () => {
  const outputDir = tempDir();
  dispatch(["observe", "--backend", "fake", "--output-dir", outputDir, "--session", "oracle"]);
  const result = dispatch(["act", "--backend", "fake", "--output-dir", outputDir, "--session", "oracle"], '{"action":"click"}');
  assert.equal(result.code, 2);
  assert.match(result.stdout ?? "", /## FerrisGrid Action Error/);
  assert.match(result.stdout ?? "", /not JSON/);
});

test("recap writes export recap for an existing session", () => {
  const outputDir = tempDir();
  const session = path.join(outputDir, "sessions", "oracle");
  dispatch(["observe", "--backend", "fake", "--output-dir", outputDir, "--session", "oracle"]);
  const result = dispatch(["recap", session]);
  assert.equal(result.code, 0);
  assert.match(result.stdout ?? "", /## FerrisGrid Recap/);
  assert.match(result.stdout ?? "", /- frame_count: 1/);
  assert.ok(fs.existsSync(path.join(session, "export", "recap.md")));
});

test("clear refuses custom paths without force and clears with force", () => {
  const outputDir = tempDir();
  assert.throws(() => dispatch(["clear", "--output-dir", outputDir]), (error) => error instanceof FerrisError && error.kind === "storage_error");
  const result = dispatch(["clear", "--output-dir", outputDir, "--force"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout ?? "", /- result: cleared/);
  assert.equal(fs.existsSync(outputDir), false);
});

test("rust fallback flag is stripped and forwards remaining args", () => {
  const result = splitRustFallbackFlag(["--use-rust-binary", "observe", "--backend", "fake"]);
  assert.equal(result.useRustBinary, true);
  assert.deepEqual(result.forwardedArgs, ["observe", "--backend", "fake"]);
});
