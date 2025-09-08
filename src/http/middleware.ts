import type { Handler, Middleware } from "./types.ts";
import { jsonError, noContent } from "./response.ts";

const addHeaders = (resp: Response, headers: HeadersInit): Response => {
  const h = new Headers(resp.headers);
  for (const [k, v] of Object.entries(headers)) h.set(k, v as string);
  return new Response(resp.body, { status: resp.status, headers: h });
};

export const compose = (middlewares: readonly Middleware[], handler: Handler): Handler =>
  middlewares.reduceRight((acc, mw) => mw(acc), handler);

export const errorMiddleware: Middleware = (next) => async (ctx) => {
  try {
    return await next(ctx);
  } catch (e) {
    ctx.ports.logger.error("Unhandled error", e);
    return jsonError({ message: "Internal Server Error" }, 500);
  }
};

export const loggingMiddleware: Middleware = (next) => async (ctx) => {
  const start = ctx.ports.clock.timestamp();
  const resp = await next(ctx);
  const ms = ctx.ports.clock.timestamp() - start;
  ctx.ports.logger.info(`${ctx.method} ${ctx.path} -> ${resp.status} ${ms}ms`);
  return resp;
};

export type CorsOptions = {
  readonly origin?: string;
  readonly methods?: readonly string[];
  readonly headers?: readonly string[];
};

export const corsMiddleware = (opts: CorsOptions = {}): Middleware => {
  const origin = opts.origin ?? "*";
  const methods = (opts.methods ?? ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]).join(", ");
  const headers = (opts.headers ?? ["Content-Type", "Authorization"]).join(", ");

  const baseHeaders = {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": methods,
    "access-control-allow-headers": headers,
  } as const;

  return (next) => async (ctx) => {
    if (ctx.method === "OPTIONS") {
      return noContent(baseHeaders);
    }
    const resp = await next(ctx);
    return addHeaders(resp, baseHeaders);
  };
};

export const securityHeadersMiddleware: Middleware = (next) => async (ctx) => {
  const resp = await next(ctx);
  return addHeaders(resp, {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "x-xss-protection": "0",
    "cross-origin-opener-policy": "same-origin",
  });
};

// TODO: Authentication/Authorization middleware (JWT/OAuth/session) with RBAC/ABAC policies.
// TODO: Request validation & sanitization (zod) per route -> 400 with problem+json.
// TODO: Rate limiting (token bucket/redis) and IP throttling. 429 Too Many Requests.
// TODO: Monitoring/metrics (OpenTelemetry), structured logs with requestId tracing.
// TODO: Security: add CSP, CSRF protection (for stateful flows), and HSTS.
// TODO: CORS: per-environment policy and preflight caching (Access-Control-Max-Age).
// TODO: Request/response middleware pipeline with typed context augmentation.
