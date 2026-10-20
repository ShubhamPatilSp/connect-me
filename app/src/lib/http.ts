import { NextResponse } from "next/server";

/** Typed error that route handlers can throw; converted to JSON at the boundary. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message: string, code = "bad_request") =>
  new HttpError(400, code, message);
export const unauthorized = (message = "Sign in to continue") =>
  new HttpError(401, "unauthorized", message);
export const forbidden = (message = "Not allowed") => new HttpError(403, "forbidden", message);
export const notFound = (message = "Not found") => new HttpError(404, "not_found", message);
export const tooMany = (message = "Too many requests") =>
  new HttpError(429, "rate_limited", message);

export function json<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

/** Wrap a handler so thrown HttpErrors become clean JSON responses. */
export function handler<A extends unknown[]>(
  fn: (...args: A) => Promise<NextResponse> | NextResponse,
): (...args: A) => Promise<NextResponse> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json(
          { error: err.code, message: err.message },
          { status: err.status, headers: { "cache-control": "no-store" } },
        );
      }
      console.error("[api] unhandled", err);
      return NextResponse.json(
        { error: "internal", message: "Something went wrong. Please try again." },
        { status: 500, headers: { "cache-control": "no-store" } },
      );
    }
  };
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw badRequest("Expected a JSON object");
    }
    return body as Record<string, unknown>;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw badRequest("Malformed JSON body");
  }
}

export function requireString(
  body: Record<string, unknown>,
  key: string,
  { min = 1, max = 2000 }: { min?: number; max?: number } = {},
): string {
  const value = body[key];
  if (typeof value !== "string") throw badRequest(`\`${key}\` must be a string`);
  const trimmed = value.trim();
  if (trimmed.length < min) throw badRequest(`\`${key}\` is too short`);
  if (trimmed.length > max) throw badRequest(`\`${key}\` is too long`);
  return trimmed;
}

export function optionalString(
  body: Record<string, unknown>,
  key: string,
  max = 2000,
): string | undefined {
  const value = body[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw badRequest(`\`${key}\` must be a string`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw badRequest(`\`${key}\` is too long`);
  return trimmed;
}

export function requireOneOf<T extends string>(
  body: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T {
  const value = body[key];
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw badRequest(`\`${key}\` must be one of: ${allowed.join(", ")}`);
  }
  return value as T;
}

export function requireNumber(
  body: Record<string, unknown>,
  key: string,
  { min = -Infinity, max = Infinity }: { min?: number; max?: number } = {},
): number {
  const value = body[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw badRequest(`\`${key}\` must be a number`);
  }
  if (value < min || value > max) throw badRequest(`\`${key}\` is out of range`);
  return value;
}
