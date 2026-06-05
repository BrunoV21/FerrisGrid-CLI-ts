<div align="center">
  <img src="https://raw.githubusercontent.com/BrunoV21/FerrisGrid-CLI/refs/heads/main/docs/branding/assets/ferrisgrid-banner.png" alt="FerrisGrid - terminal-first visual control for local AI agents" width="100%" />

  <p><strong>Turn screens into coordinates, and coordinates into action.</strong></p>

  <p>
    <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-8A2BE2?style=for-the-badge">
    <img alt="Node.js >=20" src="https://img.shields.io/badge/node.js-%3E%3D20-00E5FF?style=for-the-badge&logo=nodedotjs&logoColor=white">
    <img alt="npm package" src="https://img.shields.io/badge/npm-ferrisgrid--cli-A970FF?style=for-the-badge&logo=npm&logoColor=white">
    <img alt="TypeScript mirror" src="https://img.shields.io/badge/typescript-mirror-111111?style=for-the-badge&logo=typescript&logoColor=white">
  </p>
</div>

Date: 2026-06-05

FerrisGrid captures the current screen, maps it to deterministic coordinates, returns compact Markdown to an agent, executes one constrained action, captures the result, and exits. The agent does the reasoning. FerrisGrid handles the screen, coordinates, input, and local trace.

This repository contains the TypeScript npm package mirror of the Rust CLI. Protocol changes and new feature design should happen in the canonical Rust repository first: [`BrunoV21/FerrisGrid-CLI`](https://github.com/BrunoV21/FerrisGrid-CLI).

```text
┌──────────────┐    observe     ┌──────────────┐
│ Agent / LLM  │ ─────────────> │ FerrisGrid   │
│              │ <───────────── │ screenshot + │
│ choose one   │   Markdown     │ coordinates  │
│ action       │                └──────────────┘
│              │      act       ┌──────────────┐
│              │ ─────────────> │ validate +   │
│              │ <───────────── │ execute one  │
└──────────────┘   screenshot   └──────────────┘
```

## Why FerrisGrid?

- **Eyes plus a map:** screenshots become coordinate-backed observations an LLM can reason over.
- **Single-step by default:** every call performs one observation or one action.
- **Deterministic coordinates:** screenshots map cleanly back to native screen pixels.
- **Local-first traces:** screenshots, metadata, action requests, and results stay under `.ferrisgrid/`.
- **Rust-compatible protocol:** this package follows the Rust CLI behavior documented in [`docs/rust-oracle.md`](docs/rust-oracle.md).
- **npm-friendly distribution:** install and run the `ferrisgrid` command from a Node.js toolchain.

## Installation

For normal npm use, install the published CLI package:

```bash
npm install -g ferrisgrid-cli
ferrisgrid doctor
```

The package is [`ferrisgrid-cli`](https://www.npmjs.com/package/ferrisgrid-cli) on npm and exposes the `ferrisgrid` command.

You can also run it without a global install:

```bash
npx ferrisgrid-cli --help
```

## Quick Start

Capture the current screen:

```bash
ferrisgrid observe
```

Run one action from a Markdown action file:

```bash
mkdir -p .ferrisgrid
cat > .ferrisgrid/action.md <<'EOF'
status: action
action: click
screen_id: screen-1
x: 500
y: 500
button: left
wait_after_ms: 500
EOF

ferrisgrid act --file .ferrisgrid/action.md
```

## Development from source

Use a local checkout when you want to build, test, or modify the TypeScript package:

```bash
git clone https://github.com/BrunoV21/FerrisGrid-CLI-ts.git
cd FerrisGrid-CLI-ts
npm install
npm run build
npm test
node bin/ferrisgrid doctor
node bin/ferrisgrid observe --backend fake
```

## Commands

```text
ferrisgrid observe [options]
ferrisgrid act [options] [--file action.md]
ferrisgrid doctor [options]
ferrisgrid recap <session_path> [options]
ferrisgrid clear [options]
ferrisgrid help [observe|act|doctor|recap|clear]
```

### observe

Captures an observation frame and writes session trace files under the configured output directory.

Common options:

```text
--output-dir <path>
--session <name-or-path>
--screen-id <screen-id>
--backend <name>
--format <jpg|png>
--grid-overlay <true|false>
--resolution <fast|balanced|detail|native|pixels>
--max-image-edge <pixels|native>
--no-downsample
```

### act

Reads a compact FerrisGrid Markdown action from `--file` or stdin, validates it, executes one action, and records the result in the active session.

Common options:

```text
--file <path>
--dry-run
--output-dir <path>
--session <name-or-path>
--screen-id <screen-id>
--backend <name>
--format <jpg|png>
--grid-overlay <true|false>
--resolution <fast|balanced|detail|native|pixels>
--max-image-edge <pixels|native>
--no-downsample
```

### doctor

Prints local runtime diagnostics in Markdown.

### recap

Writes and prints a Markdown recap for a session directory.

### clear

Deletes FerrisGrid trace output. Non-default output directories require `--force`.

## Rust fallback

Passing `--use-rust-binary` bypasses the TypeScript implementation and invokes a platform-specific Rust binary instead:

```bash
ferrisgrid --use-rust-binary observe --backend fake
```

Fallback behavior:

- detects `process.platform` and `process.arch`
- expects binaries named `ferrisgrid-<platform>-<arch>` with `.exe` on Windows
- checks packaged `rust-binaries/`, packaged `bin/rust/`, and local `rust-binaries/`
- supports `FERRISGRID_RUST_BINARY` to point at an explicit binary path
- forwards stdin, stdout, stderr, arguments, and exit code
- fails clearly when no matching binary is available

## Documentation

- Official FerrisGrid docs: [`docs/official`](https://github.com/BrunoV21/FerrisGrid-CLI/tree/main/docs/official)
- Command docs: [`docs/official/commands`](https://github.com/BrunoV21/FerrisGrid-CLI/tree/main/docs/official/commands)
- Agent protocol: [`docs/official/agents.md`](https://github.com/BrunoV21/FerrisGrid-CLI/blob/main/docs/official/agents.md)
- Release notes: [`docs/official/releases`](https://github.com/BrunoV21/FerrisGrid-CLI/tree/main/docs/official/releases)
- TypeScript behavior oracle: [`docs/rust-oracle.md`](docs/rust-oracle.md)
- Canonical Rust README: [`BrunoV21/FerrisGrid-CLI`](https://github.com/BrunoV21/FerrisGrid-CLI)

## Testing

```bash
npm test
```

The smoke test suite covers help/version output, fake observations, Markdown action parsing, action error exit codes, recap export, clear safety behavior, and Rust fallback argument handling.

For documentation-only changes, a quick package metadata validation is usually enough:

```bash
npm run pack:dry-run
```

## Release process

The npm package release follows the Rust release tag. Create the same `vX.Y.Z` tag in this repository after the Rust repository has the matching tag and release notes.

The GitHub Actions release workflow:

- validates that `package.json` version matches the tag without the leading `v`
- checks out [`BrunoV21/FerrisGrid-CLI`](https://github.com/BrunoV21/FerrisGrid-CLI) at the same tag
- extracts release notes from `docs/official/releases/vX.Y.Z.md` in the Rust repository
- runs `npm ci`, `npm run build`, `npm test`, and `npm run pack:dry-run`
- publishes `ferrisgrid-cli` to npm with provenance using the `NPM_TOKEN` repository secret
- publishes a GitHub release for the TypeScript package using the Rust release notes for the same tag

For a local publish check:

```bash
npm run release:dry-run
```

## Community and feedback

- [Bug reports for the TypeScript npm package](https://github.com/BrunoV21/FerrisGrid-CLI-ts/issues/new?template=bug_report.yml)
- [Questions, documentation fixes, and npm packaging issues](https://github.com/BrunoV21/FerrisGrid-CLI-ts/issues/new?template=other.yml)
- [Feature requests and protocol changes](https://github.com/BrunoV21/FerrisGrid-CLI/issues/new?template=feature_request.yml)
- [Open TypeScript package issues](https://github.com/BrunoV21/FerrisGrid-CLI-ts/issues)
- [Open Rust CLI issues](https://github.com/BrunoV21/FerrisGrid-CLI/issues)

## Project Status

FerrisGrid is early, local-first infrastructure for agent-facing visual control. This TypeScript package is an npm-distributed mirror for the Rust CLI behavior, with feature design and protocol decisions anchored in the Rust repository.

## License

MIT
