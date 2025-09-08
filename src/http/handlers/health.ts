import type { Handler } from "../types.ts";
import { jsonOk } from "../response.ts";

export const healthHandler: Handler = (ctx) =>
  jsonOk({ status: "ok", timestamp: ctx.ports.clock.now().toISOString() });

