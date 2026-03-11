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

/** Get the current tenant's database URL, or fall back to env var. */
export function getDatabaseUrl(): string {
  return tenantStorage.getStore()?.databaseUrl || process.env.DATABASE_URL!;
}

/** Get the current tenant's repo path, or fall back to env var / default. */
export function getRepoPath(): string {
  const fromCtx = tenantStorage.getStore()?.repoPath;
  if (fromCtx) return fromCtx;
  return process.env.GIT_REPO_PATH || "";
}
