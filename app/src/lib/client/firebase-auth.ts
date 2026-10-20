"use client";

/**
 * Firebase email/password auth over the Identity Toolkit REST API.
 *
 * Deliberately no SDK: email/password needs nothing but an API key, and the
 * REST call keeps the bundle small and works identically inside the Android
 * WebView. The API key is a public client identifier, not a secret.
 */

// Public client identifier, not a secret. Baked in so the Docker build (which
// does not see .env.local) still produces a working bundle.
const API_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyAHT1sZNIw1oBXwCclN6s4Dm_3pisXFLCQ";

const FRIENDLY: Record<string, string> = {
  EMAIL_EXISTS: "That email is already registered — try signing in",
  EMAIL_NOT_FOUND: "No account with that email",
  INVALID_PASSWORD: "Wrong password",
  INVALID_LOGIN_CREDENTIALS: "Wrong email or password",
  INVALID_EMAIL: "That email doesn't look right",
  MISSING_PASSWORD: "Enter a password",
  WEAK_PASSWORD: "Password must be at least 8 characters",
  OPERATION_NOT_ALLOWED: "Email sign-in is not enabled for this project",
  TOO_MANY_ATTEMPTS_TRY_LATER: "Too many attempts — try again in a few minutes",
};

export class EmailAuthError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function call(endpoint: string, body: Record<string, unknown>): Promise<string> {
  if (!API_KEY) throw new EmailAuthError("no_key", "Firebase is not configured");

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, returnSecureToken: true }),
    },
  );

  const data = (await res.json().catch(() => ({}))) as {
    idToken?: string;
    error?: { message?: string };
  };

  if (!res.ok) {
    const raw = data.error?.message ?? "UNKNOWN";
    const code = raw.split(" : ")[0];
    throw new EmailAuthError(code, FRIENDLY[code] ?? "Could not sign you in");
  }
  if (!data.idToken) throw new EmailAuthError("no_token", "Could not sign you in");
  return data.idToken;
}

export function signUpWithEmail(email: string, password: string): Promise<string> {
  return call("signUp", { email: email.trim().toLowerCase(), password });
}

export function signInWithEmail(email: string, password: string): Promise<string> {
  return call("signInWithPassword", { email: email.trim().toLowerCase(), password });
}
