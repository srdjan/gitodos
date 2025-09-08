import type { RequestContext } from "./types.ts";

export type ApiResponse<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: unknown };

const withHeaders = (resp: Response, extra: HeadersInit): Response => {
  const headers = new Headers(resp.headers);
  for (const [k, v] of Object.entries(extra)) headers.set(k, v as string);
  return new Response(resp.body, { status: resp.status, headers });
};

export const jsonOk = <T>(data: T, status = 200, headers?: HeadersInit): Response => {
  const resp = Response.json({ success: true, data } as ApiResponse<T>, { status });
  return headers ? withHeaders(resp, headers) : resp;
};

export const jsonError = (
  error: unknown,
  status = 400,
  headers?: HeadersInit,
): Response => {
  const payload: ApiResponse<never> = { success: false, error };
  const resp = Response.json(payload, { status });
  return headers ? withHeaders(resp, headers) : resp;
};

export const text = (body: string, status = 200, headers?: HeadersInit): Response =>
  new Response(body, { status, headers: new Headers({ "content-type": "text/plain; charset=utf-8", ...(headers ?? {}) }) });

export const noContent = (headers?: HeadersInit): Response =>
  new Response(null, { status: 204, headers });

// TODO: Standardize error format with problem+json (RFC 7807) and error codes/enums.
// TODO: Add content negotiation for XML/Protobuf/etc. if needed.
// Note: Keep response helpers pure and side-effect free.

