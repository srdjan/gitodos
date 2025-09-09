import type { Logger } from "../ports/logger.ts";

export const createConsoleLogger = (): Logger => ({
  info: (message, data) => console.info(`[INFO] ${message}`, data ?? ""),
  warn: (message, data) => console.warn(`[WARN] ${message}`, data ?? ""),
  error: (message, data) => console.error(`[ERROR] ${message}`, data ?? ""),
  debug: (message, data) => console.debug(`[DEBUG] ${message}`, data ?? ""),
});


