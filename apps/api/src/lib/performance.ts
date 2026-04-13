import { AsyncLocalStorage } from "node:async_hooks";

import {
  getApiReadCacheStatsSnapshot,
  resetApiReadCacheMetrics,
} from "./api-read-cache";

interface SqlMetricSample {
  durationMs: number;
  rows: number | null;
  endpoint: string;
  sql: string;
  timestamp: string;
}

interface RequestMetricContext {
  requestId: string;
  method: string;
  path: string;
  endpoint: string;
  startedAtMs: number;
  dbMs: number;
  serializeMs: number;
  sqlCalls: number;
}

interface MetricSummaryEntry {
  name: string;
  count: number;
  p95Ms: number;
  avgMs: number;
  maxMs: number;
}

interface PerformanceSnapshot {
  capturedAt: string;
  requests: {
    endpointTop10ByP95: MetricSummaryEntry[];
  };
  sql: {
    top10ByP95: MetricSummaryEntry[];
    totalCalls: number;
  };
  cache: ReturnType<typeof getApiReadCacheStatsSnapshot>;
}

const MAX_SAMPLES_PER_KEY = 2_000;
const sqlStore = new AsyncLocalStorage<RequestMetricContext>();

const endpointDurations = new Map<string, number[]>();
const sqlDurations = new Map<string, number[]>();

function trimSamples(values: number[]): number[] {
  if (values.length <= MAX_SAMPLES_PER_KEY) {
    return values;
  }

  return values.slice(values.length - MAX_SAMPLES_PER_KEY);
}

function recordDuration(store: Map<string, number[]>, key: string, durationMs: number): void {
  const previous = store.get(key) ?? [];
  previous.push(durationMs);
  store.set(key, trimSamples(previous));
}

function computeP95(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index] ?? sorted[sorted.length - 1] ?? 0;
}

function summarizeDurations(store: Map<string, number[]>): MetricSummaryEntry[] {
  const summary: MetricSummaryEntry[] = [];

  for (const [name, values] of store.entries()) {
    if (values.length === 0) {
      continue;
    }

    const total = values.reduce((accumulator, value) => accumulator + value, 0);
    const max = values.reduce(
      (accumulator, value) => (value > accumulator ? value : accumulator),
      0,
    );

    summary.push({
      name,
      count: values.length,
      p95Ms: Number(computeP95(values).toFixed(2)),
      avgMs: Number((total / values.length).toFixed(2)),
      maxMs: Number(max.toFixed(2)),
    });
  }

  return summary
    .sort((left, right) => {
      if (right.p95Ms !== left.p95Ms) {
        return right.p95Ms - left.p95Ms;
      }

      return right.maxMs - left.maxMs;
    })
    .slice(0, 10);
}

function serializeSqlMetric(sample: SqlMetricSample): string {
  return JSON.stringify({
    type: "sql-metric",
    ...sample,
  });
}

function serializeRequestMetric(context: RequestMetricContext, statusCode: number, totalMs: number): string {
  return JSON.stringify({
    type: "endpoint-metric",
    requestId: context.requestId,
    endpoint: context.endpoint,
    method: context.method,
    path: context.path,
    statusCode,
    totalMs: Number(totalMs.toFixed(2)),
    dbMs: Number(context.dbMs.toFixed(2)),
    serializeMs: Number(context.serializeMs.toFixed(2)),
    dbSharePercent: totalMs > 0 ? Number(((context.dbMs / totalMs) * 100).toFixed(2)) : 0,
    sqlCalls: context.sqlCalls,
    timestamp: new Date().toISOString(),
  });
}

function parseEndpointName(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}

function createRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function runWithRequestPerformance<T>(
  method: string,
  path: string,
  callback: () => Promise<T> | T,
): Promise<T> | T {
  const requestContext: RequestMetricContext = {
    requestId: createRequestId(),
    method,
    path,
    endpoint: parseEndpointName(method, path),
    startedAtMs: performance.now(),
    dbMs: 0,
    serializeMs: 0,
    sqlCalls: 0,
  };

  return sqlStore.run(requestContext, callback);
}

export function markSerializationDuration(durationMs: number): void {
  const context = sqlStore.getStore();
  if (!context) {
    return;
  }

  context.serializeMs += durationMs;
}

export function recordSqlCall(
  sql: string,
  durationMs: number,
  rows: number | null,
): void {
  const context = sqlStore.getStore();
  const endpoint = context?.endpoint ?? "unknown";

  if (context) {
    context.dbMs += durationMs;
    context.sqlCalls += 1;
  }

  const roundedDuration = Number(durationMs.toFixed(2));
  recordDuration(sqlDurations, sql, roundedDuration);

  console.info(
    serializeSqlMetric({
      durationMs: roundedDuration,
      rows,
      endpoint,
      sql,
      timestamp: new Date().toISOString(),
    }),
  );
}

export function finalizeRequestPerformance(statusCode: number): void {
  const context = sqlStore.getStore();
  if (!context) {
    return;
  }

  const totalMs = performance.now() - context.startedAtMs;
  recordDuration(endpointDurations, context.endpoint, totalMs);

  console.info(serializeRequestMetric(context, statusCode, totalMs));
}

export function getPerformanceSnapshot(): PerformanceSnapshot {
  const endpointSummary = summarizeDurations(endpointDurations);
  const sqlSummary = summarizeDurations(sqlDurations);
  const totalSqlCalls = Array.from(sqlDurations.values()).reduce(
    (accumulator, durations) => accumulator + durations.length,
    0,
  );

  return {
    capturedAt: new Date().toISOString(),
    requests: {
      endpointTop10ByP95: endpointSummary,
    },
    sql: {
      top10ByP95: sqlSummary,
      totalCalls: totalSqlCalls,
    },
    cache: getApiReadCacheStatsSnapshot(),
  };
}

export function resetPerformanceSnapshot(): void {
  endpointDurations.clear();
  sqlDurations.clear();
  resetApiReadCacheMetrics();
}
