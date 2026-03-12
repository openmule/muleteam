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
