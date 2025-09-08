import type { Handler } from "../types.ts";
import { jsonError, jsonOk } from "../response.ts";

// TODO: Validate request body with zod schema; sanitize fields before echoing back.
// TODO: Document this endpoint in OpenAPI once schema layer is added.

export const echoHandler: Handler = async (ctx) => {
  try {
    const contentType = ctx.req.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return jsonError({ message: "Expected application/json" }, 415);
    }
    const body = await ctx.req.json();
    return jsonOk({ youPosted: body }, 200);
  } catch (e) {
    return jsonError({ message: "Bad Request", details: String(e) }, 400);
  }
};
