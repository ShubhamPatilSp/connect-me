/**
 * Firebase ID token verification — without a service account.
 *
 * Google publishes the public certificates used to sign ID tokens. Fetching
 * them and verifying the RS256 signature locally is equivalent to what the
 * Admin SDK does, but needs no private key, so there is no credential to leak
 * or rotate. Certificates are cached until the Cache-Control max-age expires.
 */

import crypto from "node:crypto";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? "connect-me-93fda";
const CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

export interface FirebaseIdentity {
  uid: string;
  /** E.164, e.g. +919000000001 — null for email accounts. */
  phone: string | null;
  /** Verified email — null for phone accounts. */
  email: string | null;
} 

let cache: { certs: Record<string, string>; expiresAt: number } | null = null;

async function getCerts(): Promise<Record<string, string>> {
  if (cache && cache.expiresAt > Date.now()) return cache.certs;

  const res = await fetch(CERTS_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not fetch signing certificates (${res.status})`);

  const certs = (await res.json()) as Record<string, string>;
  const maxAge = /max-age=(\d+)/.exec(res.headers.get("cache-control") ?? "");
  const ttl = maxAge ? Number(maxAge[1]) * 1000 : 3_600_000;
  cache = { certs, expiresAt: Date.now() + ttl };
  return certs;
}

const b64url = (input: string): Buffer =>
  Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");

export async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseIdentity> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Malformed token");

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = JSON.parse(b64url(headerB64).toString("utf8")) as { alg?: string; kid?: string };
  if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported token algorithm");

  let certs = await getCerts();
  if (!certs[header.kid]) {
    // Key rotation — refetch once before rejecting.
    cache = null;
    certs = await getCerts();
  }
  const pem = certs[header.kid];
  if (!pem) throw new Error("Unknown signing key");

  const publicKey = new crypto.X509Certificate(pem).publicKey;
  const valid = crypto.verify(
    "RSA-SHA256",
    Buffer.from(`${headerB64}.${payloadB64}`),
    publicKey,
    b64url(signatureB64),
  );
  if (!valid) throw new Error("Invalid token signature");

  const payload = JSON.parse(b64url(payloadB64).toString("utf8")) as Record<string, unknown>;
  const now = Math.floor(Date.now() / 1000);

  if (payload.aud !== PROJECT_ID) throw new Error("Token audience mismatch");
  if (payload.iss !== `https://securetoken.google.com/${PROJECT_ID}`) {
    throw new Error("Token issuer mismatch");
  }
  if (typeof payload.exp !== "number" || payload.exp < now - 60) throw new Error("Token expired");
  if (typeof payload.iat !== "number" || payload.iat > now + 60) throw new Error("Token not yet valid");
  if (typeof payload.sub !== "string" || payload.sub.length === 0) throw new Error("Token has no subject");
  const phone = typeof payload.phone_number === "string" ? payload.phone_number : null;
  const email = typeof payload.email === "string" ? payload.email : null;
  if (!phone && !email) throw new Error("Token has no phone number or email");

  return { uid: payload.sub, phone, email };
}
