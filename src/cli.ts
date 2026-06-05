#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { runAct, runClear, runDoctor, runObserve, runRecap, type CommandResult } from "./commands";
import { helpText, isHelpRequest, type HelpTopic } from "./help";
import { ferrisError } from "./errors";
import { renderError } from "./render";
import { runRustFallback, splitRustFallbackFlag } from "./rustFallback";
import { version } from "./index";

export async function main(argv = process.argv.slice(2), stdin?: string): Promise<number> {
  const fallback = splitRustFallbackFlag(argv);

  try {
    if (fallback.useRustBinary) return runRustFallback(fallback.forwardedArgs);
    const result = dispatch(fallback.forwardedArgs, stdin);
    if (result.stdout) process.stdout.write(ensureNewline(result.stdout));
    if (result.stderr) process.stderr.write(ensureNewline(result.stderr));
    return result.code;
  } catch (error) {
    process.stderr.write(renderError(error));
    return 1;
  }
}

export function dispatch(args: string[], stdin?: string): CommandResult {
  if (args.length === 0 || isHelpRequest(args.slice(0, 1))) return { code: 0, stdout: helpText("root") };
  if (args[0] === "--version" || args[0] === "-V") return { code: 0, stdout: `ferrisgrid ${version}\n` };
  if (args[0] === "help") return { code: 0, stdout: helpText(helpTopic(args[1])) };

  const command = args[0];
  const rest = args.slice(1);
  if (isHelpRequest(rest)) return { code: 0, stdout: helpText(helpTopic(command)) };
  switch (command) {
    case "observe":
      return runObserve(rest);
    case "act":
      return runAct(rest, stdin ?? (rest.includes("--file") ? "" : readStdin()));
    case "doctor":
      return runDoctor(rest);
    case "recap":
      return runRecap(rest);
    case "clear":
      return runClear(rest);
    default:
      throw ferrisError("protocol_error", `unknown command: ${command}`);
  }
}

function helpTopic(value: string | undefined): HelpTopic {
  if (value === "observe" || value === "act" || value === "doctor" || value === "recap" || value === "clear") return value;
  return "root";
}

function readStdin(): string {
  try {
    return process.stdin.isTTY ? "" : readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function ensureNewline(output: string): string {
  return output.endsWith("\n") ? output : `${output}\n`;
}

if (require.main === module) {
  main()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      process.stderr.write(renderError(error));
      process.exitCode = 1;
    });
}
