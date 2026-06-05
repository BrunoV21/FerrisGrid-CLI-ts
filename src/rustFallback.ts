import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { ferrisError } from "./errors";

export function splitRustFallbackFlag(args: string[]): { useRustBinary: boolean; forwardedArgs: string[] } {
  const index = args.indexOf("--use-rust-binary");
  if (index < 0) return { useRustBinary: false, forwardedArgs: args };
  return { useRustBinary: true, forwardedArgs: [...args.slice(0, index), ...args.slice(index + 1)] };
}

export function runRustFallback(args: string[]): number {
  const binary = resolveRustBinary();
  const result = spawnSync(binary, args, { stdio: "inherit" });
  if (result.error) throw ferrisError("execution_error", `failed to invoke Rust fallback binary: ${result.error.message}`);
  if (typeof result.status === "number") return result.status;
  return result.signal ? 1 : 0;
}

function resolveRustBinary(): string {
  if (process.env.FERRISGRID_RUST_BINARY) return assertExecutable(process.env.FERRISGRID_RUST_BINARY);
  const name = binaryName();
  const packageRoot = path.join(__dirname, "..", "..");
  const candidates = [
    path.join(__dirname, "..", "rust-binaries", name),
    path.join(packageRoot, "rust-binaries", name),
    path.join(packageRoot, "bin", "rust", name),
    path.join(process.cwd(), "rust-binaries", name),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw ferrisError("platform_error", `Rust fallback binary is unavailable for ${process.platform}-${process.arch}; expected one of: ${candidates.join(", ")}`);
}

function assertExecutable(candidate: string): string {
  if (!fs.existsSync(candidate)) throw ferrisError("platform_error", `Rust fallback binary is unavailable: ${candidate}`);
  return candidate;
}

function binaryName(): string {
  const ext = process.platform === "win32" ? ".exe" : "";
  return `ferrisgrid-${process.platform}-${process.arch}${ext}`;
}
