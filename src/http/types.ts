import type { Clock } from "../ports/clock.ts";
import type { Logger } from "../ports/logger.ts";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";

export type AppPorts = {
  readonly clock: Clock;
  readonly logger: Logger;
};

export type RequestContext = {
  readonly req: Request;
  readonly url: URL;
  readonly method: HttpMethod;
  readonly path: string;
  readonly params: Readonly<Record<string, string>>; // TODO: add path params when router supports it
  readonly ports: AppPorts;
};

export type Handler = (ctx: RequestContext) => Promise<Response> | Response;

// TODO: Typed context augmentation after middleware (e.g., ctx.user after auth, ctx.body after validation).

export type Middleware = (next: Handler) => Handler;
