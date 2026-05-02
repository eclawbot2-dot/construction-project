/**
 * NextAuth SSO provider config — env-gated. Each provider activates
 * only when the matching client_id + secret are present in .env. This
 * lets the same build run with no SSO (dev), SSO with one provider,
 * or all providers (multi-IdP enterprise tenants).
 *
 * Sign-in URLs:
 *   /api/auth/signin/okta
 *   /api/auth/signin/azure-ad
 *   /api/auth/signin/google
 *   /api/auth/signin/auth0
 *
 * Required env vars (set whichever providers you want active):
 *   OKTA_CLIENT_ID, OKTA_CLIENT_SECRET, OKTA_ISSUER
 *   AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, AZURE_AD_TENANT_ID
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 *   AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_ISSUER
 *
 * The auth callback (./auth.ts) needs to handle account-linking — on
 * first SSO login, find or create a User by email and stash
 * ssoProvider + ssoSubject. Existing-email collisions reject (so an
 * attacker can't impersonate a credentials user via SSO with the
 * same email).
 */

import type { Provider } from "next-auth/providers";
import Okta from "next-auth/providers/okta";
import AzureAD from "next-auth/providers/azure-ad";
import Google from "next-auth/providers/google";
import Auth0 from "next-auth/providers/auth0";

export function ssoProviders(): Provider[] {
  const out: Provider[] = [];
  if (process.env.OKTA_CLIENT_ID && process.env.OKTA_CLIENT_SECRET && process.env.OKTA_ISSUER) {
    out.push(Okta({
      clientId: process.env.OKTA_CLIENT_ID,
      clientSecret: process.env.OKTA_CLIENT_SECRET,
      issuer: process.env.OKTA_ISSUER,
    }));
  }
  if (process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET && process.env.AZURE_AD_TENANT_ID) {
    out.push(AzureAD({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
    }));
  }
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    out.push(Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }));
  }
  if (process.env.AUTH0_CLIENT_ID && process.env.AUTH0_CLIENT_SECRET && process.env.AUTH0_ISSUER) {
    out.push(Auth0({
      clientId: process.env.AUTH0_CLIENT_ID,
      clientSecret: process.env.AUTH0_CLIENT_SECRET,
      issuer: process.env.AUTH0_ISSUER,
    }));
  }
  return out;
}

/** List provider IDs currently active for UI rendering. */
export function activeSsoProviderIds(): string[] {
  return ssoProviders().map((p) => {
    const cfg = typeof p === "function" ? p({}) : p;
    return (cfg as { id?: string }).id ?? "unknown";
  });
}
