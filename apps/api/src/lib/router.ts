import type { IncomingMessage, ServerResponse } from "node:http";
import { promisify } from "node:util";
import { brotliCompress, constants as zlibConstants, gzip } from "node:zlib";

import { getActiveApiReadCache } from "./api-read-cache";
import { sendError, sendNoContent } from "./http";
import { HttpError, toHttpError } from "./http-errors";
import {
  finalizeRequestPerformance,
  runWithRequestPerformance,
} from "./performance";

export interface RouteContext {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  params: Readonly<Record<string, string>>;
}

export interface RouteDefinition {
  method: string;
  path: string;
  handler: (context: RouteContext) => Promise<void> | void;
}

const gzipAsync = promisify(gzip);
const brotliCompressAsync = promisify(brotliCompress);
const MIN_COMPRESSIBLE_BODY_BYTES = 1024;

function normalizePathSegments(path: string): string[] {
  return path.split("/").filter((segment) => segment.length > 0);
}

function matchRoutePath(
  routePath: string,
  pathname: string,
): Readonly<Record<string, string>> | null {
  if (routePath === pathname) {
    return {};
  }

  const routeSegments = normalizePathSegments(routePath);
  const pathSegments = normalizePathSegments(pathname);

  if (routeSegments.length !== pathSegments.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let index = 0; index < routeSegments.length; index += 1) {
    const routeSegment = routeSegments[index];
    const pathSegment = pathSegments[index];

    if (!routeSegment || !pathSegment) {
      return null;
    }

    if (routeSegment.startsWith(":")) {
      const paramName = routeSegment.slice(1);
      if (paramName.length === 0) {
        return null;
      }

      params[paramName] = decodeURIComponent(pathSegment);
      continue;
    }

    if (routeSegment !== pathSegment) {
      return null;
    }
  }

  return params;
}

function resolvePreferredEncoding(acceptEncodingHeader: string | undefined): "br" | "gzip" | null {
  if (!acceptEncodingHeader) {
    return null;
  }

  const normalized = acceptEncodingHeader.toLowerCase();
  if (normalized.includes("br")) {
    return "br";
  }

  if (normalized.includes("gzip")) {
    return "gzip";
  }

  return null;
}

function shouldBypassCompressionForLocalDev(hostHeader: string | string[] | undefined): boolean {
  if (!hostHeader) {
    return false;
  }

  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  if (!host) {
    return false;
  }

  return host === "localhost:5173" || host === "127.0.0.1:5173";
}

async function maybeCompressResponseBody(
  bodyBuffer: Buffer,
  responseHeaders: ReadonlyMap<string, string>,
  acceptEncodingHeader: string | undefined,
  hostHeader?: string | string[],
): Promise<{ bodyBuffer: Buffer; contentEncoding: "br" | "gzip" | null }> {
  if (bodyBuffer.length < MIN_COMPRESSIBLE_BODY_BYTES) {
    return { bodyBuffer, contentEncoding: null };
  }

  const contentType = responseHeaders.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return { bodyBuffer, contentEncoding: null };
  }

  const existingEncoding = responseHeaders.get("content-encoding");
  if (existingEncoding) {
    return { bodyBuffer, contentEncoding: null };
  }

  if (shouldBypassCompressionForLocalDev(hostHeader)) {
    return { bodyBuffer, contentEncoding: null };
  }

  const preferredEncoding = resolvePreferredEncoding(acceptEncodingHeader);
  if (!preferredEncoding) {
    return { bodyBuffer, contentEncoding: null };
  }

  if (preferredEncoding === "br") {
    const compressed = await brotliCompressAsync(bodyBuffer, {
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: 4,
      },
    });
    return { bodyBuffer: Buffer.from(compressed), contentEncoding: "br" };
  }

  const compressed = await gzipAsync(bodyBuffer, { level: 6 });
  return { bodyBuffer: Buffer.from(compressed), contentEncoding: "gzip" };
}

function toOutputHeaderName(name: string): string {
  switch (name) {
    case "content-type":
      return "Content-Type";
    case "content-length":
      return "Content-Length";
    case "content-encoding":
      return "Content-Encoding";
    case "access-control-allow-origin":
      return "Access-Control-Allow-Origin";
    case "access-control-allow-headers":
      return "Access-Control-Allow-Headers";
    case "access-control-allow-methods":
      return "Access-Control-Allow-Methods";
    case "vary":
      return "Vary";
    default:
      return name;
  }
}

export function createRouter(routes: RouteDefinition[]) {
  const readCache = getActiveApiReadCache();

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const method = req.method ?? "GET";
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    return runWithRequestPerformance(method, url.pathname, async () => {
      try {
        if (method === "OPTIONS") {
          sendNoContent(res);
          return;
        }

        let matchedRoute:
          | { route: RouteDefinition; params: Readonly<Record<string, string>> }
          | null = null;
        for (const route of routes) {
          if (route.method !== method) {
            continue;
          }

          const params = matchRoutePath(route.path, url.pathname);
          if (params === null) {
            continue;
          }

          matchedRoute = {
            route,
            params,
          };
          break;
        }

        if (!matchedRoute) {
          throw new HttpError(404, "not_found", "Route not found");
        }

        const cacheContext = {
          method,
          routePath: matchedRoute.route.path,
          pathname: url.pathname,
          searchParams: url.searchParams,
        } as const;

        const cachedResponse = readCache.get(cacheContext);
        if (cachedResponse) {
          const cachedHeaders = new Map(
            Object.entries(cachedResponse.headers).map(([name, value]) => [
              name.toLowerCase(),
              value,
            ]),
          );
          const cachedBodyBuffer = Buffer.from(cachedResponse.body, "utf8");
          const compressedCachedResponse = await maybeCompressResponseBody(
            cachedBodyBuffer,
            cachedHeaders,
            req.headers["accept-encoding"],
            req.headers.host,
          );

          res.statusCode = cachedResponse.statusCode;
          for (const [name, value] of cachedHeaders.entries()) {
            if (name === "content-length" || name === "content-encoding" || name === "vary") {
              continue;
            }
            res.setHeader(toOutputHeaderName(name), value);
          }
          if (compressedCachedResponse.contentEncoding) {
            res.setHeader("Content-Encoding", compressedCachedResponse.contentEncoding);
            res.setHeader("Vary", "Accept-Encoding");
          }
          res.setHeader("Content-Length", String(compressedCachedResponse.bodyBuffer.length));

          res.end(compressedCachedResponse.bodyBuffer);
          return;
        }

        const originalSetHeader = res.setHeader.bind(res);
        const originalEnd = res.end.bind(res);
        const capturedHeaders = new Map<string, string>();
        let responseBodyBuffer = Buffer.alloc(0);
        let responseEnded = false;

        res.setHeader = ((name: string, value: number | string | readonly string[]) => {
          capturedHeaders.set(
            name.toLowerCase(),
            Array.isArray(value) ? value.join(", ") : String(value),
          );
          return res;
        }) as typeof res.setHeader;

        res.end = ((chunk?: string | Buffer | Uint8Array, ...args: unknown[]) => {
          responseEnded = true;
          if (typeof chunk === "string") {
            responseBodyBuffer = Buffer.from(chunk, "utf8");
          } else if (chunk instanceof Buffer) {
            responseBodyBuffer = Buffer.from(chunk);
          } else if (chunk instanceof Uint8Array) {
            responseBodyBuffer = Buffer.from(chunk);
          } else {
            responseBodyBuffer = Buffer.alloc(0);
          }

          return res;
        }) as typeof res.end;

        let routeError: unknown = null;
        try {
          await matchedRoute.route.handler({ req, res, url, params: matchedRoute.params });
        } catch (error) {
          routeError = error;
        } finally {
          res.setHeader = originalSetHeader;
          res.end = originalEnd;
        }

        if (routeError) {
          if (responseEnded) {
            console.error(
              JSON.stringify({
                service: "api",
                status: "request-error-after-response-started",
                code: "internal_error",
                message: "Internal server error",
              }),
            );
          } else {
            throw routeError;
          }
        }

        if (!responseEnded) {
          return;
        }

        const compressedResponse = await maybeCompressResponseBody(
          responseBodyBuffer,
          capturedHeaders,
          req.headers["accept-encoding"],
          req.headers.host,
        );

        if (res.statusCode === 200 && responseBodyBuffer.length > 0) {
          readCache.set(cacheContext, {
            statusCode: res.statusCode,
            body: responseBodyBuffer.toString("utf8"),
            headers: Object.fromEntries(capturedHeaders.entries()),
          });
        }

        res.statusCode = res.statusCode;
        for (const [name, value] of capturedHeaders.entries()) {
          if (name === "content-length" || name === "content-encoding" || name === "vary") {
            continue;
          }
          originalSetHeader(toOutputHeaderName(name), value);
        }
        if (compressedResponse.contentEncoding) {
          originalSetHeader("Content-Encoding", compressedResponse.contentEncoding);
          originalSetHeader("Vary", "Accept-Encoding");
        }
        originalSetHeader("Content-Length", String(compressedResponse.bodyBuffer.length));
        originalEnd(compressedResponse.bodyBuffer);
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

        console.error(
          JSON.stringify({
            service: "api",
            status: "request-error",
            code: httpError.code,
            message: httpError.message,
            details:
              error instanceof Error
                ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                  }
                : String(error),
          }),
        );

        sendError(
          res,
          {
            code: httpError.code,
            message: httpError.message,
          },
          httpError.statusCode,
        );
      } finally {
        finalizeRequestPerformance(res.statusCode);
      }
    });
  };
}
