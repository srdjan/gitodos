// Light FP Result utilities

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export const map = <T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> =>
  result.ok ? ok(fn(result.value)) : result;

export const flatMap = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> => (result.ok ? fn(result.value) : result);

export const mapError = <T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F,
): Result<T, F> => (result.ok ? result : err(fn(result.error)));

export const fromPromise = async <T, E = unknown>(
  promise: Promise<T>,
  onError: (e: unknown) => E,
): Promise<Result<T, E>> => {
  try {
    const value = await promise;
    return ok(value);
  } catch (e) {
    return err(onError(e));
  }
};

// TODO: Add unit tests for Result utilities (ok/err/map/flatMap/mapError/fromPromise).
// TODO: Consider adding Result helpers: tap, fold, and async variants.
