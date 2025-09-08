// Minimal production-ready Deno HTTP server skeleton (Light FP style)

import { createClock } from "./adapters/real-clock.ts";
import { createConsoleLogger } from "./adapters/console-logger.ts";
import type { AppPorts, HttpMethod, RequestContext } from "./http/types.ts";
import {
  compose,
  corsMiddleware,
  errorMiddleware,
  loggingMiddleware,
  securityHeadersMiddleware,
} from "./http/middleware.ts";
import { notFound, Router } from "./http/router.ts";
import { healthHandler } from "./http/handlers/health.ts";
import { echoHandler } from "./http/handlers/echo.ts";

const clock = createClock();
const logger = createConsoleLogger();
const ports: AppPorts = { clock, logger };

const router = new Router()
  .add("GET", "/health", healthHandler)
  .add("POST", "/echo", echoHandler);

const baseHandler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const method = req.method.toUpperCase() as HttpMethod;
  const path = url.pathname;
  const handler = router.match(method, path) ?? notFound;

  const ctx: RequestContext = {
    req,
    url,
    method,
    path,
    params: {},
    ports,
  };

  return await handler(ctx);
};

const handler = compose([
  errorMiddleware,
  loggingMiddleware,
  corsMiddleware({ origin: "*" }),
  securityHeadersMiddleware,
], baseHandler);

const PORT = Number(Deno.env.get("PORT") ?? 8000);
logger.info(`Starting HTTP server on http://localhost:${PORT}`);

Deno.serve({ port: PORT }, handler);
