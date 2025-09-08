import type { Handler, HttpMethod } from "./types.ts";
import { jsonError } from "./response.ts";

const keyOf = (method: HttpMethod, path: string): string => `${method}:${path}`;

export class Router {
  private readonly routes = new Map<string, Handler>();

  add(method: HttpMethod, path: string, handler: Handler): this {
    this.routes.set(keyOf(method, path), handler);
    return this;
  }

  match(method: string, path: string): Handler | undefined {
    const m = method.toUpperCase() as HttpMethod;
    return this.routes.get(keyOf(m, path));
  }
}

export const notFound: Handler = () => jsonError({ message: "Not Found" }, 404);

// TODO: Add path params (e.g., /users/:id) with fast pattern matching and param extraction.
// TODO: Add route-level middleware and input/output schema validation.
// TODO: Generate OpenAPI (and docs site) from route schemas and metadata.
// TODO: Add automatic HEAD handling for GET routes and 405 Method Not Allowed support.
