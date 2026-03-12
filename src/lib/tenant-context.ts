import { AsyncLocalStorage } from "node:async_hooks";

export interface TenantContext {
  databaseUrl?: string;
  repoPath?: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

/** Run a callback with tenant-specific overrides for DB and git storage. */
export function withTenant<T>(ctx: TenantContext, fn: () => T): T {
  return tenantStorage.run(ctx, fn);
}

/**
 * Get the current tenant's database URL.
 * Priority: ALS context → request header → env var.
 *
 * For hosted platform: the platform middleware sets x-tenant-database-url
 * request header with the tenant's NeonDB branch connection string.
 */
export async function getDatabaseUrl(): Promise<string> {
  // 1. Check ALS context (set by withTenant)
  const fromAls = tenantStorage.getStore()?.databaseUrl;
  if (fromAls) return fromAls;

  // 2. Check request header (set by platform middleware for hosted tenants)
  try {
    const { headers } = await import("next/headers");
    const headerStore = await headers();
    const fromHeader = headerStore.get("x-tenant-database-url");
    if (fromHeader) return fromHeader;
  } catch {
    // Not in a request context — fall through to env var
  }

  // 3. Fall back to env var (self-hosted / default)
  return process.env.DATABASE_URL!;
}

/** Get the current tenant's repo path, or fall back to env var / default. */
export function getRepoPath(): string {
  const fromCtx = tenantStorage.getStore()?.repoPath;
  if (fromCtx) return fromCtx;
  return process.env.GIT_REPO_PATH || "";
}

/**
 * Wrap an API route handler with tenant context from request headers.
 * Reads x-team-slug and x-tenant-database-url, sets ALS so that
 * getRepoPath() and getDatabaseUrl() return tenant-specific values.
 *
 * For self-hosted (no x-team-slug header), runs fn() without ALS override.
 */
export async function withTenantFromRequest<T>(request: Request, fn: () => T | Promise<T>): Promise<T> {
  const rawSlug = request.headers.get("x-team-slug");
  const dbUrl = request.headers.get("x-tenant-database-url") || undefined;

  // Validate slug to prevent path traversal
  const slug = rawSlug && /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(rawSlug) ? rawSlug : null;

  if (!slug && !dbUrl) return fn();

  const path = await import("path");
  const fs = await import("fs");

  let repoPath: string | undefined;
  if (slug) {
    const base = process.env.GIT_REPO_BASE || process.env.GIT_REPO_PATH || "";
    if (base) {
      repoPath = path.default.join(base, "tenants", slug);
      if (!fs.default.existsSync(repoPath)) {
        fs.default.mkdirSync(repoPath, { recursive: true });
      }
    }
  }

  return tenantStorage.run({ databaseUrl: dbUrl, repoPath }, fn);
}
