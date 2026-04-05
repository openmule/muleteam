import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

/**
 * Shared cookie options for auth tokens.
 *
 * When COOKIE_DOMAIN is set (e.g. ".themule.team"), cookies are shared across
 * all subdomains — enabling platform mode where each team gets a subdomain
 * (team-a.themule.team, team-b.themule.team) but auth is shared.
 *
 * Without COOKIE_DOMAIN, cookies are scoped to the exact hostname (default
 * browser behavior), which works for single-domain deployments.
 */
export const cookieOptions: Partial<ResponseCookie> = {
  httpOnly: true,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
};
