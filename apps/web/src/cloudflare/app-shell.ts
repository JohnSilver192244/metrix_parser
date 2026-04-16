import { AsyncLocalStorage } from "node:async_hooks";

import {
  createCloudflareFetchHandler,
  type CloudflareApiRuntimeEnv,
} from "../../../api/src/cloudflare/fetch-handler-spike";

export interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

export interface CloudflareAppShellEnv extends CloudflareApiRuntimeEnv {
  ASSETS: AssetsBinding;
}

export interface ScheduledControllerLike {
  cron: string;
  scheduledTime: number;
}

export interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

type ScheduledTask = (
  controller: ScheduledControllerLike,
  env: CloudflareAppShellEnv,
  ctx: ExecutionContextLike,
) => Promise<void>;

const ASSET_PATH_PATTERN = /\.[a-z0-9]+$/i;
const scheduledTasksByCron = new Map<string, ScheduledTask>();
const appShellEnvStorage = new AsyncLocalStorage<CloudflareAppShellEnv>();
type FetchHandler = (
  request: Request,
  env: CloudflareAppShellEnv,
) => Promise<Response>;

const stableCloudflareApiHandler = createCloudflareFetchHandler(
  undefined,
  () => appShellEnvStorage.getStore(),
);
const apiHandler: FetchHandler = (request, env) =>
  appShellEnvStorage.run(env, () => stableCloudflareApiHandler(request));

function isAssetRequest(pathname: string): boolean {
  return ASSET_PATH_PATTERN.test(pathname);
}

function isDocumentNavigationRequest(request: Request): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }

  const secFetchDest = request.headers.get("sec-fetch-dest");
  if (secFetchDest === "document") {
    return true;
  }

  const accept = request.headers.get("accept")?.toLowerCase() ?? "";
  return accept.includes("text/html");
}

export function shouldHandleWithApi(request: Request): boolean {
  const pathname = new URL(request.url).pathname;

  if (isAssetRequest(pathname)) {
    return false;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return true;
  }

  if (request.headers.has("authorization")) {
    return true;
  }

  // SPA document navigations and API fetches intentionally share paths like /players.
  return !isDocumentNavigationRequest(request);
}

export function createCloudflareAppShell(
  handler: FetchHandler = apiHandler,
): {
  fetch(request: Request, env: CloudflareAppShellEnv): Promise<Response>;
  scheduled(
    controller: ScheduledControllerLike,
    env: CloudflareAppShellEnv,
    ctx: ExecutionContextLike,
  ): Promise<void>;
} {
  return {
    async fetch(request: Request, env: CloudflareAppShellEnv): Promise<Response> {
      if (shouldHandleWithApi(request)) {
        return handler(request, env);
      }

      return env.ASSETS.fetch(request);
    },
    async scheduled(
      controller: ScheduledControllerLike,
      env: CloudflareAppShellEnv,
      ctx: ExecutionContextLike,
    ): Promise<void> {
      const task = scheduledTasksByCron.get(controller.cron);

      if (!task) {
        console.log(
          JSON.stringify({
            service: "web-cloudflare-shell",
            event: "scheduled-noop",
            cron: controller.cron,
            scheduledTime: controller.scheduledTime,
          }),
        );
        return;
      }

      await task(controller, env, ctx);
    },
  };
}
