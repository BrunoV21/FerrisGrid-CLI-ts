# FerrisGrid Rust CLI Behavior Oracle

Date: 2026-06-05

This document captures the observable Rust CLI behavior that the TypeScript npm package must reproduce.

## Commands

- `ferrisgrid` with no arguments prints root help to stdout and exits 0.
- `ferrisgrid -h`, `ferrisgrid --help`, and `ferrisgrid help` print root help to stdout and exit 0.
- `ferrisgrid help <observe|act|doctor|recap|clear>` prints command help to stdout and exits 0.
- `ferrisgrid <command> -h`, `--help`, or `help` prints command help to stdout and exits 0.
- Unknown commands fail with `protocol_error` and exit 1.

### `observe`

Flags:

- `--output-dir <path>` default `.ferrisgrid`, env `FERRISGRID_OUTPUT_DIR`
- `--session <name-or-path>`
- `--screen-id <screen-id>` default env `FERRISGRID_DEFAULT_SCREEN_ID`
- `--format <jpg|jpeg|png>` default `jpg`; extension for `jpeg` is `jpg`
- `--grid-overlay <true|false|1|0|yes|no>` default `true`
- `--resolution <fast|balanced|detail|native|pixels>` default adaptive balanced
- `--max-image-edge <pixels|native|none|off|0>` env `FERRISGRID_MAX_IMAGE_EDGE`
- `--no-downsample`
- `--backend <name>` default env `FERRISGRID_BACKEND` or `native`

Rejected on `observe`:

- `--dry-run` → `--dry-run is only supported by ferrisgrid act`
- `--file` → `--file is only supported by ferrisgrid act`
- unknown shared flags → `unknown flag: <flag>`

Output starts with `## FerrisGrid Observation` and includes session path, step, coordinate mode `normalized-1000`, image size limit, screen count, per-screen screenshot and metadata paths, and coordinate mapping lines.

### `act`

Flags:

- all shared observe flags
- `--file <path>` reads compact Markdown action from a file; otherwise stdin is read fully
- `--dry-run` validates and captures result without emitting input

Input format:

- Compact Markdown `key: value` lines only.
- Blank lines and `#` comments are ignored.
- JSON inputs starting with `{` or `[` are rejected.
- `status` defaults to `action` when omitted.
- `status: done` and `status: fail` do not execute input and do not capture post-action screenshots.

Actions:

- `click`: `x`, `y`, optional `screen_id`, optional `button` default `left`
- `double_click`: same as click
- `right_click`: `x`, `y`, optional `screen_id`
- `move_mouse`: `x`, `y`, optional `screen_id`
- `drag`: `from_x`, `from_y`, `to_x`, `to_y`, optional `screen_id`, optional `duration_ms` default `450`, optional `button` default `left`
- `scroll`: required `delta_y`, optional `delta_x` default `0`, optional paired `x` and `y`, optional `screen_id`
- `type`: `text`
- `press_key`: `key`
- `hotkey`: `keys`, split on `+`, empty segments removed
- `wait`: `duration_ms`

Action limits and validation:

- Coordinates must be integers in `0..1000`.
- `button` must be `left`, `right`, or `middle`.
- `wait_after_ms` must be `<= 30000`.
- `wait duration_ms` must be `<= 30000`.
- Drag `duration_ms` must be `<= 5000`.
- Scroll `x` and `y` must be supplied together or omitted together.
- Scroll `delta_x` and `delta_y` absolute values must be `<= 2000`.
- Typed text must be at most 500 characters.
- Hotkey must contain 1 to 4 parsed keys.
- `press_key` key must not be empty.
- Pointer actions require a screen when multiple screens are active; `--screen-id` supplies the default.
- `primary` aliases to the primary screen.

Output:

- Success starts with `## FerrisGrid Action Result`, includes session, step, action summary, optional `wait_after_ms`, result, screen count, and post-action screen metadata.
- Action rejection starts with `## FerrisGrid Action Error`, prints to stdout, and exits 2.
- Non-action CLI/runtime errors print `## FerrisGrid Error` to stderr and exit 1.

### `doctor`

Flags:

- `--output-dir <path>` default `.ferrisgrid`, env `FERRISGRID_OUTPUT_DIR`
- `--backend <name>` default env `FERRISGRID_BACKEND` or `native`

Unknown flags fail as `unknown doctor flag: <flag>`.

Output starts with `## FerrisGrid Doctor` and includes OS, capture status, input capabilities, output directory, screens, and ffmpeg availability.

### `recap`

Arguments and flags:

- Required positional `<session_path>`
- `--video mp4`
- `--framerate <positive integer>` default `2`
- `--fps <positive integer>` alias for `--framerate`

Failures:

- Missing session path → `recap requires a session path`
- Unknown flags → `unknown recap flag: <flag>`
- Unsupported video format → `unsupported video format: <value>`
- Non-positive or non-integer framerate fails protocol validation.

Output starts with `## FerrisGrid Recap` and includes session, frame count, recap path, and optional video path.

### `clear`

Flags:

- `--output-dir <path>` default `.ferrisgrid`, env `FERRISGRID_OUTPUT_DIR`
- `--force` required for non-`.ferrisgrid` custom paths

Failures:

- Unknown flags → `unknown clear flag: <flag>`
- Empty path, `.`, or `/` → `refusing to clear an unsafe output directory`
- Custom path without `--force` → `refusing to clear a custom output directory without --force`

Output starts with `## FerrisGrid Clear` and includes output directory plus result `cleared` or `already_clean`.

## Backends and external programs

Backend names:

- `fake`
- `native`
- `macos`, `native-macos`
- `linux`, `x11`, `native-linux`, `native-linux-x11`
- Unknown backend names fall back to the platform native backend.

External local programs used by Rust:

- macOS capture: `/usr/sbin/screencapture`
- macOS input: `osascript` plus ApplicationServices/CoreGraphics APIs
- Linux capture: `xrandr`, `xdpyinfo`, ImageMagick `import`
- Linux input: `xdotool`
- Recap video: `ffmpeg`
- Doctor probes `ffmpeg -version`

No network or HTTP API calls exist in the Rust CLI implementation. Help text contains documentation URLs only.

## Filesystem behavior

Default output root is `.ferrisgrid` unless `FERRISGRID_OUTPUT_DIR` or `--output-dir` overrides it.

Created layout:

```text
.ferrisgrid/
  config.toml
  sessions/
    <session-id>/
      manifest.md
      events.md
      frames/
        000001/
          screen-1.jpg|png
          screen-1.meta.md
      actions/
        000002.md
      export/
        recap.md
        session.mp4
```

`config.toml` is created if missing with:

```toml
default_output_dir = ".ferrisgrid"
storage_mode = "all"
```

Session IDs are `<unix_millis>-<process_id>`. `observe` creates/resumes sessions. `act` uses the latest session unless `--session` is supplied and fails if no session exists.

## Exit codes

- `0`: successful help, observe, act, doctor, recap, or clear
- `1`: top-level CLI/runtime errors rendered as `## FerrisGrid Error` to stderr
- `2`: `act` action rejection rendered as `## FerrisGrid Action Error` to stdout

## Rust tests and examples

No standalone example files were found. Embedded tests cover:

- root and command help content
- help topic parsing
- command help detection
- observe rejecting act-only options
- doctor rejecting irrelevant flags
- resolution parsing and dimensions for the fake backend
- coordinate mapping
- action parsing
- JSON rejection
- multi-screen screen-id requirements
- default screen-id behavior
- terminal status action results
- X11 screen parsing
- adaptive image scaling

---
Co-authored by [Nova](https://www.compassap.ai/portfolio/nova.html)
