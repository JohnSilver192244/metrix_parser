import type { IncomingMessage, ServerResponse } from "node:http";

import { sendError } from "./http";
import { HttpError, toHttpError } from "./http-errors";

export interface RouteContext {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
}

export interface RouteDefinition {
  method: string;
  path: string;
  handler: (context: RouteContext) => Promise<void> | void;
}

export function createRouter(routes: RouteDefinition[]) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      const method = req.method ?? "GET";
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      const route = routes.find((candidate) => {
        return candidate.method === method && candidate.path === url.pathname;
      });

      if (!route) {
        throw new HttpError(404, "not_found", "Route not found");
      }

      await route.handler({ req, res, url });
    } catch (error) {
      const httpError = toHttpError(error);
      if (res.headersSent || res.writableEnded) {
        console.error(
          JSON.stringify({
            service: "api",
            status: "request-error-after-response-started",
            code: httpError.code,
            message: httpError.message,
          }),
        );
        return;
      }

      sendError(
        res,
        {
          code: httpError.code,
          message: httpError.message,
        },
        httpError.statusCode,
      );
    }
  };
}
