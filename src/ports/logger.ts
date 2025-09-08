export interface Logger {
  readonly info: (message: string, data?: unknown) => void;
  readonly warn: (message: string, data?: unknown) => void;
  readonly error: (message: string, data?: unknown) => void;
  readonly debug: (message: string, data?: unknown) => void;
}

