import type { Logger } from "../ports/logger.ts";

export const createConsoleLogger = (): Logger => ({
  info: (message, data) => console.info(`[INFO] ${message}`, data ?? ""),
  warn: (message, data) => console.warn(`[WARN] ${message}`, data ?? ""),
  error: (message, data) => console.error(`[ERROR] ${message}`, data ?? ""),
  debug: (message, data) => console.debug(`[DEBUG] ${message}`, data ?? ""),
});

// TODO: Replace with structured logging (JSON) and correlation IDs (requestId) for tracing.
// TODO: Add sinks/transports (e.g., to file, HTTP, OpenTelemetry) with backpressure handling.

