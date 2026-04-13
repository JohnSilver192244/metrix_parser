interface RouteMetricStore {
  ttfbMs: number[];
  apiDurationMs: number[];
  lcpMs: number[];
}

interface MetricSummaryEntry {
  route: string;
  count: number;
  p95Ms: number;
  avgMs: number;
  maxMs: number;
}

interface WebPerformanceSnapshot {
  capturedAt: string;
  ttfbTop10ByP95: MetricSummaryEntry[];
  apiDurationTop10ByP95: MetricSummaryEntry[];
  lcpTop10ByP95: MetricSummaryEntry[];
}

interface WebPerformanceGlobal {
  snapshot: () => WebPerformanceSnapshot;
  reset: () => void;
}

const MAX_SAMPLES_PER_ROUTE = 1_000;
const routeMetrics = new Map<string, RouteMetricStore>();

let observerInitialized = false;
let activeRoutePath = "/";

function toP95(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index] ?? sorted[sorted.length - 1] ?? 0;
}

function trim(values: number[]): number[] {
  if (values.length <= MAX_SAMPLES_PER_ROUTE) {
    return values;
  }

  return values.slice(values.length - MAX_SAMPLES_PER_ROUTE);
}

function ensureRoute(routePath: string): RouteMetricStore {
  const existing = routeMetrics.get(routePath);
  if (existing) {
    return existing;
  }

  const created: RouteMetricStore = {
    ttfbMs: [],
    apiDurationMs: [],
    lcpMs: [],
  };
  routeMetrics.set(routePath, created);
  return created;
}

function recordRouteValue(
  routePath: string,
  metric: keyof RouteMetricStore,
  value: number,
): void {
  if (!Number.isFinite(value) || value < 0) {
    return;
  }

  const store = ensureRoute(routePath);
  store[metric].push(Number(value.toFixed(2)));
  store[metric] = trim(store[metric]);
}

function summarizeByMetric(metric: keyof RouteMetricStore): MetricSummaryEntry[] {
  const summary: MetricSummaryEntry[] = [];

  for (const [route, metrics] of routeMetrics.entries()) {
    const values = metrics[metric];
    if (values.length === 0) {
      continue;
    }

    const total = values.reduce((accumulator, value) => accumulator + value, 0);
    const max = values.reduce(
      (accumulator, value) => (value > accumulator ? value : accumulator),
      0,
    );

    summary.push({
      route,
      count: values.length,
      p95Ms: Number(toP95(values).toFixed(2)),
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

function getCurrentRoutePath(): string {
  if (typeof window === "undefined") {
    return activeRoutePath;
  }

  return window.location.pathname || activeRoutePath;
}

function publishGlobalApi(): void {
  if (typeof window === "undefined") {
    return;
  }

  const api: WebPerformanceGlobal = {
    snapshot: getWebPerformanceSnapshot,
    reset: resetWebPerformance,
  };

  (window as typeof window & { __METRIX_WEB_PERF__?: WebPerformanceGlobal }).__METRIX_WEB_PERF__ =
    api;
}

export function setActiveRouteForPerformance(routePath: string): void {
  if (!routePath) {
    return;
  }

  activeRoutePath = routePath;
  ensureRoute(routePath);
}

export function observeApiCallPerformance(params: {
  apiPath: string;
  method: string;
  status: number;
  ttfbMs: number;
  durationMs: number;
}): void {
  const routePath = getCurrentRoutePath();

  recordRouteValue(routePath, "ttfbMs", params.ttfbMs);
  recordRouteValue(routePath, "apiDurationMs", params.durationMs);

  console.info(
    JSON.stringify({
      type: "web-api-metric",
      route: routePath,
      apiPath: params.apiPath,
      method: params.method.toUpperCase(),
      status: params.status,
      ttfbMs: Number(params.ttfbMs.toFixed(2)),
      durationMs: Number(params.durationMs.toFixed(2)),
      timestamp: new Date().toISOString(),
    }),
  );
}

export function initWebPerformanceTracking(): void {
  if (observerInitialized || typeof window === "undefined") {
    return;
  }

  observerInitialized = true;
  setActiveRouteForPerformance(window.location.pathname || "/");
  publishGlobalApi();

  if (typeof PerformanceObserver === "undefined") {
    return;
  }

  try {
    const observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      for (const entry of entries) {
        if (entry.entryType !== "largest-contentful-paint") {
          continue;
        }

        const routePath = getCurrentRoutePath();
        recordRouteValue(routePath, "lcpMs", entry.startTime);

        console.info(
          JSON.stringify({
            type: "web-lcp-metric",
            route: routePath,
            lcpMs: Number(entry.startTime.toFixed(2)),
            timestamp: new Date().toISOString(),
          }),
        );
      }
    });

    observer.observe({ type: "largest-contentful-paint", buffered: true });
  } catch {
    // PerformanceObserver LCP may be unavailable in older browsers/testing runtimes.
  }
}

export function getWebPerformanceSnapshot(): WebPerformanceSnapshot {
  return {
    capturedAt: new Date().toISOString(),
    ttfbTop10ByP95: summarizeByMetric("ttfbMs"),
    apiDurationTop10ByP95: summarizeByMetric("apiDurationMs"),
    lcpTop10ByP95: summarizeByMetric("lcpMs"),
  };
}

export function resetWebPerformance(): void {
  routeMetrics.clear();
}
