import * as fs from "node:fs";
import * as path from "node:path";
import { ferrisError } from "./errors";

export class SessionStore {
  constructor(readonly root: string) {}

  ensureRoot(): void {
    fs.mkdirSync(path.join(this.root, "sessions"), { recursive: true });
    const configPath = path.join(this.root, "config.toml");
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, 'default_output_dir = ".ferrisgrid"\nstorage_mode = "all"\n');
    }
  }

  resolveSession(requested: string | undefined, createIfMissing: boolean): string {
    this.ensureRoot();
    if (requested) {
      const sessionDir = fs.existsSync(requested) || requested.includes("/") || requested.includes("\\")
        ? requested
        : path.join(this.root, "sessions", requested);
      if (fs.existsSync(sessionDir) || createIfMissing) {
        this.ensureSessionDirs(sessionDir);
        return sessionDir;
      }
      throw ferrisError("storage_error", `session not found: ${sessionDir}`);
    }
    const latest = this.latestSession();
    if (latest) return latest;
    if (createIfMissing) return this.createSession();
    throw ferrisError("storage_error", "no existing session; run ferrisgrid observe first or pass --session");
  }

  createSession(): string {
    this.ensureRoot();
    const sessionDir = path.join(this.root, "sessions", `${Date.now()}-${process.pid}`);
    this.ensureSessionDirs(sessionDir);
    return sessionDir;
  }

  latestSession(): string | undefined {
    const sessionsDir = path.join(this.root, "sessions");
    if (!fs.existsSync(sessionsDir)) return undefined;
    const entries = fs.readdirSync(sessionsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(sessionsDir, entry.name))
      .sort();
    return entries.at(-1);
  }

  nextStep(sessionDir: string): number {
    const frames = path.join(sessionDir, "frames");
    fs.mkdirSync(frames, { recursive: true });
    let maxStep = 0;
    for (const entry of fs.readdirSync(frames, { withFileTypes: true })) {
      if (entry.isDirectory() && /^\d+$/.test(entry.name)) maxStep = Math.max(maxStep, Number(entry.name));
    }
    return maxStep + 1;
  }

  frameDir(sessionDir: string, step: number): string {
    const dir = path.join(sessionDir, "frames", step.toString().padStart(6, "0"));
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  appendEvent(sessionDir: string, line: string): void {
    fs.appendFileSync(path.join(sessionDir, "events.md"), `- ${line}\n`);
  }

  writeActionFiles(sessionDir: string, step: number, request: string, parsed: string, result: string): void {
    const actions = path.join(sessionDir, "actions");
    fs.mkdirSync(actions, { recursive: true });
    fs.writeFileSync(path.join(actions, `${step.toString().padStart(6, "0")}.md`), `## FerrisGrid Action\n- step: ${step}\n\n### Request\n\`\`\`text\n${request.trim()}\n\`\`\`\n\n### Parsed\n\`\`\`text\n${parsed.trim()}\n\`\`\`\n\n### Result\n\`\`\`text\n${result.trim()}\n\`\`\`\n`);
  }

  private ensureSessionDirs(sessionDir: string): void {
    fs.mkdirSync(path.join(sessionDir, "frames"), { recursive: true });
    const manifest = path.join(sessionDir, "manifest.md");
    if (!fs.existsSync(manifest)) {
      fs.writeFileSync(manifest, `## FerrisGrid Session\n- session_id: ${path.basename(sessionDir)}\n- created_at_unix_ms: ${Date.now()}\n`);
    }
  }
}
