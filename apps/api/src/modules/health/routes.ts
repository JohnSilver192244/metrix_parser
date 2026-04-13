import type { RouteDefinition } from "../../lib/router";

import { sendSuccess } from "../../lib/http";
import {
  getPerformanceSnapshot,
  resetPerformanceSnapshot,
} from "../../lib/performance";

export const healthRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/health",
    handler: ({ res }) => {
      sendSuccess(res, {
        service: "api",
        status: "ok",
        timestamp: new Date().toISOString(),
      });
    },
  },
  {
    method: "GET",
    path: "/health/performance",
    handler: ({ res }) => {
      sendSuccess(res, getPerformanceSnapshot());
    },
  },
  {
    method: "POST",
    path: "/health/performance/reset",
    handler: ({ res }) => {
      resetPerformanceSnapshot();
      sendSuccess(res, {
        status: "reset",
      });
    },
  },
];
