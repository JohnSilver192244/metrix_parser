import type { RouteDefinition } from "../../lib/router";

import { sendSuccess } from "../../lib/http";

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
];
