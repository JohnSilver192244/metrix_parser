import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http";

import { createApiRequestHandler } from "../app";
import type { ApiRuntimeEnvOverride } from "../config/env";
import { runWithApiRuntimeEnv } from "../config/env";
import type { ApiModuleDependencies } from "../modules";
import type { WorkerEnvOverride } from "../../../worker/src/config/env";
import { runWithWorkerEnv } from "../../../worker/src/config/env";

type HeaderValue = number | string | readonly string[];

interface ResponseRecorder {
  statusCode: number;
  readonly headersSent: boolean;
  readonly writableEnded: boolean;
  setHeader(name: string, value: HeaderValue): ResponseRecorder;
  end(chunk?: string | Uint8Array): ResponseRecorder;
}

export interface CloudflareApiRuntimeEnv
  extends Pick<ApiRuntimeEnvOverride, "supabaseServiceRoleKey" | "supabaseUrl">,
    Pick<
      WorkerEnvOverride,
      | "discGolfMetrixApiCode"
      | "discGolfMetrixBaseUrl"
      | "discGolfMetrixCountryCode"
      | "supabaseServiceRoleKey"
      | "supabaseUrl"
    > {}

function toNodeRequestHeaders(request: Request): IncomingHttpHeaders {
  const headers: IncomingHttpHeaders = {};

  request.headers.forEach((value, key) => {
    if (key.toLowerCase() === "accept-encoding") {
      return;
    }
    headers[key] = value;
  });

  if (!headers.host) {
    headers.host = new URL(request.url).host;
  }

  return headers;
}

function toRequestHeadersEntries(
  headers: IncomingHttpHeaders,
): Array<[string, string]> {
  return Object.entries(headers).flatMap(([name, value]) => {
    if (typeof value === "undefined") {
      return [];
    }

    return [[name, Array.isArray(value) ? value.join(", ") : value]];
  });
}

async function createNodeLikeRequest(request: Request): Promise<IncomingMessage> {
  const bodyBuffer =
    request.method === "GET" || request.method === "HEAD"
      ? new Uint8Array()
      : new Uint8Array(await request.arrayBuffer());

  const nodeLikeRequest = {
    method: request.method,
    url: (() => {
      const url = new URL(request.url);
      return `${url.pathname}${url.search}`;
    })(),
    headers: toNodeRequestHeaders(request),
    async *[Symbol.asyncIterator]() {
      if (bodyBuffer.length > 0) {
        yield bodyBuffer;
      }
    },
  };

  return nodeLikeRequest as IncomingMessage;
}

function createResponseRecorder(): ResponseRecorder & {
  headers: Map<string, string>;
  getBodyBuffer(): ArrayBuffer | null;
} {
  const headers = new Map<string, string>();
  let headersSent = false;
  let writableEnded = false;
  let bodyBuffer: ArrayBuffer | null = null;

  return {
    statusCode: 200,
    get headersSent() {
      return headersSent;
    },
    get writableEnded() {
      return writableEnded;
    },
    headers,
    getBodyBuffer() {
      return bodyBuffer;
    },
    setHeader(name: string, value: HeaderValue) {
      headers.set(
        name,
        Array.isArray(value) ? value.map(String).join(", ") : String(value),
      );
      return this;
    },
    end(chunk?: string | Uint8Array) {
      headersSent = true;
      writableEnded = true;

      if (typeof chunk === "string") {
        bodyBuffer = new TextEncoder().encode(chunk).buffer;
      } else if (chunk instanceof Uint8Array) {
        bodyBuffer = Uint8Array.from(chunk).buffer;
      } else {
        bodyBuffer = null;
      }

      return this;
    },
  };
}

export function adaptNodeHandlerToCloudflareFetch(
  nodeHandler: (req: IncomingMessage, res: ServerResponse) => Promise<void>,
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const req = await createNodeLikeRequest(request);
    const res = createResponseRecorder();

    await nodeHandler(req, res as unknown as ServerResponse);

    const bodyBuffer = res.getBodyBuffer();

    return new Response(bodyBuffer, {
      status: res.statusCode,
      headers: Array.from(res.headers.entries()),
    });
  };
}

export function createCloudflareFetchHandler(
  dependencies?: ApiModuleDependencies,
  getRuntimeEnv?: (request: Request) => CloudflareApiRuntimeEnv | undefined,
): (request: Request) => Promise<Response> {
  const nodeHandler = createApiRequestHandler(dependencies);

  return adaptNodeHandlerToCloudflareFetch(async (req, res) => {
    const requestUrl = req.url ?? "/";
    const request = new Request(`https://cloudflare-adapter.local${requestUrl}`, {
      method: req.method ?? "GET",
      headers: toRequestHeadersEntries(req.headers),
    });
    const runtimeEnv = getRuntimeEnv?.(request);

    await runWithApiRuntimeEnv(
      {
        supabaseUrl: runtimeEnv?.supabaseUrl,
        supabaseServiceRoleKey: runtimeEnv?.supabaseServiceRoleKey,
      },
      () =>
        runWithWorkerEnv(
          {
            supabaseUrl: runtimeEnv?.supabaseUrl,
            supabaseServiceRoleKey: runtimeEnv?.supabaseServiceRoleKey,
            discGolfMetrixBaseUrl: runtimeEnv?.discGolfMetrixBaseUrl,
            discGolfMetrixCountryCode: runtimeEnv?.discGolfMetrixCountryCode,
            discGolfMetrixApiCode: runtimeEnv?.discGolfMetrixApiCode,
          },
          () => nodeHandler(req, res),
        ),
    );
  });
}

export const createCloudflareFetchSpikeHandler = createCloudflareFetchHandler;
