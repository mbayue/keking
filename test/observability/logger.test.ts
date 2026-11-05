import { describe, expect, test } from "bun:test";

import {
  createLogger,
  formatLogLine,
  writeToConsole,
  type LogLevel,
} from "../../src/observability/logger.ts";


describe("structured logger", () => {
  test("formats JSON log lines", () => {
    const line = formatLogLine("info", "command", { status: "ok" }, "2026-11-05T00:00:00.000Z");
    expect(JSON.parse(line)).toEqual({
      timestamp: "2026-11-05T00:00:00.000Z",
      level: "info",
      event: "command",
      status: "ok",
    });
  });

  test("writes debug lines to the console log method", () => {
    const lines: string[] = [];
    const originalLog = console.log;
    console.log = (line: string) => {
      lines.push(line);
    };

    try {
      writeToConsole("debug", "debug-line");
    } finally {
      console.log = originalLog;
    }

    expect(lines).toEqual(["debug-line"]);
  });

  test("writes each level through the supplied sink", () => {
    const entries: string[] = [];
    const logger = createLogger((level: LogLevel, line: string) => {
      entries.push(`${level}:${line}`);
    });

    logger.debug("debug_event");
    logger.info("info_event");
    logger.warn("warn_event");
    logger.error("error_event");

    expect(entries).toHaveLength(4);
    expect(entries[0]).toContain("debug_event");
    expect(entries[3]).toContain("error_event");
  });
});
