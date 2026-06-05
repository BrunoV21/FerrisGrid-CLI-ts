export type ErrorKind =
  | "capture_error"
  | "permission_error"
  | "coordinate_error"
  | "agent_error"
  | "protocol_error"
  | "execution_error"
  | "storage_error"
  | "platform_error"
  | "user_interrupt";

export class FerrisError extends Error {
  constructor(
    public readonly kind: ErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "FerrisError";
  }
}

export function ferrisError(kind: ErrorKind, message: string): FerrisError {
  return new FerrisError(kind, message);
}

export function renderTopLevelError(error: unknown): string {
  const ferris = toFerrisError(error);
  return `## FerrisGrid Error\n- type: ${ferris.kind}\n- reason: ${ferris.message}\n\n`;
}

export function toFerrisError(error: unknown): FerrisError {
  if (error instanceof FerrisError) {
    return error;
  }
  if (error instanceof Error) {
    return new FerrisError("storage_error", error.message);
  }
  return new FerrisError("storage_error", String(error));
}
