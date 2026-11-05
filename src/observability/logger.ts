export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

export function formatLogLine(
  level: LogLevel,
  event: string,
  fields: LogFields = {},
  timestamp = new Date().toISOString(),
): string {
  return JSON.stringify({
    timestamp,
    level,
    event,
    ...fields,
  });
}

export function writeToConsole(level: LogLevel, line: string): void {
  const method = level === "debug" ? "log" : level;
  console[method](line);
}

export function createLogger(
  write: (level: LogLevel, line: string) => void = writeToConsole,
): {
  debug: (event: string, fields?: LogFields) => void;
  info: (event: string, fields?: LogFields) => void;
  warn: (event: string, fields?: LogFields) => void;
  error: (event: string, fields?: LogFields) => void;
} {
  return {
    debug: (event, fields = {}) => write("debug", formatLogLine("debug", event, fields)),
    info: (event, fields = {}) => write("info", formatLogLine("info", event, fields)),
    warn: (event, fields = {}) => write("warn", formatLogLine("warn", event, fields)),
    error: (event, fields = {}) => write("error", formatLogLine("error", event, fields)),
  };
}

export const logger = createLogger();
