import type { Clock } from "../ports/clock.ts";

export const createClock = (): Clock => ({
  now: () => new Date(),
  timestamp: () => Date.now(),
});

