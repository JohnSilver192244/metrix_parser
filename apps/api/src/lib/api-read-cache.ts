interface CacheGetContext {
  method: string;
  routePath: string;
  pathname: string;
  searchParams: URLSearchParams;
}

interface CacheSetContext extends CacheGetContext {}

interface CachedResponse {
  statusCode: number;
  body: string;
  headers: Record<string, string>;
}

interface CacheEntry {
  response: CachedResponse;
  expiresAtMs: number;
  routePath: string;
  pathname: string;
  query: ReadonlyMap<string, readonly string[]>;
  createdAtMs: number;
}

interface ApiReadCacheStatsSnapshot {
  enabled: boolean;
  backend: "memory";
  ttlSeconds: number;
  maxEntries: number;
  size: number;
  hitCount: number;
  missCount: number;
  evictionCount: number;
  invalidationCount: number;
  hitRatePercent: number;
  getLatencyMs: {
    avg: number;
    p95: number;
  };
}

interface ApiReadCacheConfig {
  enabled: boolean;
  ttlSeconds: number;
  maxEntries: number;
}

const MAX_LATENCY_SAMPLES = 2_000;
const CACHED_GET_ROUTE_PATHS = new Set<string>([
  "/players",
  "/players/:playerId",
  "/players/results",
  "/competitions",
  "/competitions/:competitionId/context",
  "/results",
]);

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function parseEnabled(value: string | undefined, fallback = true): boolean {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "0" || normalized === "false" || normalized === "off") {
    return false;
  }

  if (normalized === "1" || normalized === "true" || normalized === "on") {
    return true;
  }

  return fallback;
}

function sortSearchParams(searchParams: URLSearchParams): URLSearchParams {
  const entries = [...searchParams.entries()].sort(([leftKey, leftValue], [rightKey, rightValue]) => {
    const keyComparison = leftKey.localeCompare(rightKey);
    if (keyComparison !== 0) {
      return keyComparison;
    }

    return leftValue.localeCompare(rightValue);
  });

  const sortedParams = new URLSearchParams();
  for (const [key, value] of entries) {
    sortedParams.append(key, value);
  }

  return sortedParams;
}

function normalizeQuery(searchParams: URLSearchParams): ReadonlyMap<string, readonly string[]> {
  const normalized = new Map<string, string[]>();
  const sorted = sortSearchParams(searchParams);

  for (const [key, value] of sorted.entries()) {
    const values = normalized.get(key) ?? [];
    values.push(value);
    normalized.set(key, values);
  }

  return normalized;
}

function createCacheKey(context: CacheGetContext): string {
  const normalizedParams = sortSearchParams(context.searchParams).toString();
  return `${context.method.toUpperCase()}|${context.routePath}|${context.pathname}?${normalizedParams}`;
}

function resolveDefaultConfig(): ApiReadCacheConfig {
  const ttlSeconds = clampNumber(
    parsePositiveInteger(process.env.API_READ_CACHE_TTL_SECONDS, 30),
    15,
    60,
  );
  const maxEntries = parsePositiveInteger(process.env.API_READ_CACHE_MAX_ENTRIES, 2_000);

  return {
    enabled: parseEnabled(process.env.API_READ_CACHE_ENABLED, true),
    ttlSeconds,
    maxEntries,
  };
}

function computeP95(samples: readonly number[]): number {
  if (samples.length === 0) {
    return 0;
  }

  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index] ?? sorted[sorted.length - 1] ?? 0;
}

function shouldCacheRoute(context: CacheGetContext): boolean {
  return context.method.toUpperCase() === "GET" && CACHED_GET_ROUTE_PATHS.has(context.routePath);
}

export class ApiReadCache {
  private readonly config: ApiReadCacheConfig;

  private readonly store = new Map<string, CacheEntry>();

  private readonly getLatencySamplesMs: number[] = [];

  private hitCount = 0;

  private missCount = 0;

  private evictionCount = 0;

  private invalidationCount = 0;

  constructor(config: Partial<ApiReadCacheConfig> = {}) {
    const defaults = resolveDefaultConfig();
    this.config = {
      enabled: config.enabled ?? defaults.enabled,
      ttlSeconds: config.ttlSeconds ?? defaults.ttlSeconds,
      maxEntries: config.maxEntries ?? defaults.maxEntries,
    };
  }

  get(context: CacheGetContext): CachedResponse | null {
    const startedAtMs = performance.now();
    let outcome: CachedResponse | null = null;

    try {
      if (!this.config.enabled || !shouldCacheRoute(context)) {
        this.missCount += 1;
        return null;
      }

      const key = createCacheKey(context);
      const cachedEntry = this.store.get(key);
      if (!cachedEntry) {
        this.missCount += 1;
        return null;
      }

      if (cachedEntry.expiresAtMs <= Date.now()) {
        this.store.delete(key);
        this.missCount += 1;
        return null;
      }

      this.hitCount += 1;
      outcome = cachedEntry.response;
      return outcome;
    } finally {
      const durationMs = performance.now() - startedAtMs;
      this.getLatencySamplesMs.push(durationMs);
      if (this.getLatencySamplesMs.length > MAX_LATENCY_SAMPLES) {
        this.getLatencySamplesMs.splice(
          0,
          this.getLatencySamplesMs.length - MAX_LATENCY_SAMPLES,
        );
      }
    }
  }

  set(context: CacheSetContext, response: CachedResponse): void {
    if (!this.config.enabled || !shouldCacheRoute(context)) {
      return;
    }

    if (response.statusCode !== 200 || response.body.length === 0) {
      return;
    }

    const key = createCacheKey(context);
    const nowMs = Date.now();
    const entry: CacheEntry = {
      response,
      expiresAtMs: nowMs + this.config.ttlSeconds * 1000,
      routePath: context.routePath,
      pathname: context.pathname,
      query: normalizeQuery(context.searchParams),
      createdAtMs: nowMs,
    };

    this.store.set(key, entry);
    this.trimToMaxEntries();
  }

  invalidateAll(): void {
    if (this.store.size === 0) {
      return;
    }

    this.invalidationCount += this.store.size;
    this.store.clear();
  }

  invalidateAfterBackgroundRecompute(context: {
    seasonCode?: string;
    competitionIds?: readonly string[];
  }): void {
    const competitionIds = new Set(
      (context.competitionIds ?? [])
        .map((competitionId) => competitionId.trim())
        .filter((competitionId) => competitionId.length > 0),
    );
    const seasonCode = context.seasonCode?.trim();

    let removedEntriesCount = 0;

    for (const [key, entry] of this.store.entries()) {
      if (this.shouldInvalidateEntryAfterBackgroundRecompute(entry, seasonCode, competitionIds)) {
        this.store.delete(key);
        removedEntriesCount += 1;
      }
    }

    this.invalidationCount += removedEntriesCount;
  }

  snapshot(): ApiReadCacheStatsSnapshot {
    const getCalls = this.hitCount + this.missCount;
    const avgLatencyMs = getCalls > 0
      ? this.getLatencySamplesMs.reduce((sum, value) => sum + value, 0) /
        this.getLatencySamplesMs.length
      : 0;

    return {
      enabled: this.config.enabled,
      backend: "memory",
      ttlSeconds: this.config.ttlSeconds,
      maxEntries: this.config.maxEntries,
      size: this.store.size,
      hitCount: this.hitCount,
      missCount: this.missCount,
      evictionCount: this.evictionCount,
      invalidationCount: this.invalidationCount,
      hitRatePercent: getCalls > 0 ? Number(((this.hitCount / getCalls) * 100).toFixed(2)) : 0,
      getLatencyMs: {
        avg: Number(avgLatencyMs.toFixed(2)),
        p95: Number(computeP95(this.getLatencySamplesMs).toFixed(2)),
      },
    };
  }

  resetMetrics(): void {
    this.hitCount = 0;
    this.missCount = 0;
    this.evictionCount = 0;
    this.invalidationCount = 0;
    this.getLatencySamplesMs.splice(0, this.getLatencySamplesMs.length);
  }

  private trimToMaxEntries(): void {
    while (this.store.size > this.config.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (!oldestKey) {
        break;
      }

      this.store.delete(oldestKey);
      this.evictionCount += 1;
    }
  }

  private shouldInvalidateEntryAfterBackgroundRecompute(
    entry: CacheEntry,
    seasonCode: string | undefined,
    competitionIds: ReadonlySet<string>,
  ): boolean {
    const readSidePath =
      entry.routePath === "/players" ||
      entry.routePath === "/players/:playerId" ||
      entry.routePath === "/players/results" ||
      entry.routePath === "/competitions" ||
      entry.routePath === "/competitions/:competitionId/context" ||
      entry.routePath === "/results";

    if (!readSidePath) {
      return false;
    }

    // Conservative invalidation:
    // read-side projections can cross entity boundaries (season standings, aggregations),
    // so background recompute should invalidate full read-side cache unless we can prove
    // the key is outside the affected scope.
    if (!seasonCode && competitionIds.size === 0) {
      return true;
    }

    const seasonCodes = entry.query.get("seasonCode") ?? [];
    if (seasonCode && seasonCodes.includes(seasonCode)) {
      return true;
    }

    if (competitionIds.size === 0) {
      // List endpoints without season filter may still include recomputed aggregates.
      return entry.routePath === "/competitions" || entry.routePath === "/players";
    }

    const queryCompetitionIds = entry.query.get("competitionId") ?? [];
    for (const competitionId of queryCompetitionIds) {
      if (competitionIds.has(competitionId)) {
        return true;
      }
    }

    const contextCompetitionId = entry.pathname.match(/^\/competitions\/([^/]+)\/context$/)?.[1];
    if (contextCompetitionId && competitionIds.has(decodeURIComponent(contextCompetitionId))) {
      return true;
    }

    // Keep invalidation broad for list routes to avoid stale season_points aggregates.
    return entry.routePath === "/competitions" || entry.routePath === "/players";
  }
}

let activeApiReadCache: ApiReadCache = new ApiReadCache();

export function getActiveApiReadCache(): ApiReadCache {
  return activeApiReadCache;
}

export function configureApiReadCache(config?: Partial<ApiReadCacheConfig>): ApiReadCache {
  activeApiReadCache = new ApiReadCache(config);
  return activeApiReadCache;
}

export function invalidateApiReadCacheAfterBackgroundRecompute(context: {
  seasonCode?: string;
  competitionIds?: readonly string[];
}): void {
  activeApiReadCache.invalidateAfterBackgroundRecompute(context);
}

export function invalidateApiReadCacheAll(): void {
  activeApiReadCache.invalidateAll();
}

export function getApiReadCacheStatsSnapshot(): ApiReadCacheStatsSnapshot {
  return activeApiReadCache.snapshot();
}

export function resetApiReadCacheMetrics(): void {
  activeApiReadCache.resetMetrics();
}
