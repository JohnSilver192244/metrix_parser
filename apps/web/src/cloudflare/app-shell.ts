import { AsyncLocalStorage } from "node:async_hooks";

import {
  createCloudflareFetchHandler,
  type CloudflareApiRuntimeEnv,
} from "../../../api/src/cloudflare/fetch-handler-spike";
import {
  createAcceptedUpdateRouteDependencies,
  runScheduledUpdate,
} from "./update-jobs";

export interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

export interface CloudflareAppShellEnv extends CloudflareApiRuntimeEnv {
  ASSETS: AssetsBinding;
}

type CloudflareEnvBindings = {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  DISCGOLFMETRIX_BASE_URL?: string;
  DISCGOLFMETRIX_COUNTRY_CODE?: string;
  DISCGOLFMETRIX_API_CODE?: string;
};

type LocalBuildEnv = {
  __LOCAL_SUPABASE_URL__?: string;
  __LOCAL_SUPABASE_SERVICE_ROLE_KEY__?: string;
  __LOCAL_DISCGOLFMETRIX_BASE_URL__?: string;
  __LOCAL_DISCGOLFMETRIX_COUNTRY_CODE__?: string;
  __LOCAL_DISCGOLFMETRIX_API_CODE__?: string;
};

export interface ScheduledControllerLike {
  cron: string;
  scheduledTime: number;
}

export interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

const ASSET_PATH_PATTERN = /\.[a-z0-9]+$/i;
const appShellRuntimeStorage = new AsyncLocalStorage<{
  env: CloudflareAppShellEnv;
  ctx?: ExecutionContextLike;
}>();
type FetchHandler = (
  request: Request,
  env: CloudflareAppShellEnv,
  ctx?: ExecutionContextLike,
) => Promise<Response>;

const stableCloudflareApiHandler = createCloudflareFetchHandler(
  {
    updates: createAcceptedUpdateRouteDependencies(() => appShellRuntimeStorage.getStore()),
  },
  () => appShellRuntimeStorage.getStore()?.env,
);
const apiHandler: FetchHandler = (request, env, ctx) =>
  appShellRuntimeStorage.run({ env, ctx }, () => stableCloudflareApiHandler(request));

function normalizeOptionalEnvValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

export function resolveCloudflareAppShellEnv(
  env: CloudflareAppShellEnv,
): CloudflareAppShellEnv {
  const bindings = env as CloudflareAppShellEnv & CloudflareEnvBindings;
  const localBuildEnv = globalThis as typeof globalThis & LocalBuildEnv;

  return {
    ...env,
    supabaseUrl:
      env.supabaseUrl ??
      normalizeOptionalEnvValue(bindings.SUPABASE_URL) ??
      normalizeOptionalEnvValue(localBuildEnv.__LOCAL_SUPABASE_URL__),
    supabaseServiceRoleKey:
      env.supabaseServiceRoleKey ??
      normalizeOptionalEnvValue(bindings.SUPABASE_SERVICE_ROLE_KEY) ??
      normalizeOptionalEnvValue(localBuildEnv.__LOCAL_SUPABASE_SERVICE_ROLE_KEY__),
    discGolfMetrixBaseUrl:
      env.discGolfMetrixBaseUrl ??
      normalizeOptionalEnvValue(bindings.DISCGOLFMETRIX_BASE_URL) ??
      normalizeOptionalEnvValue(localBuildEnv.__LOCAL_DISCGOLFMETRIX_BASE_URL__),
    discGolfMetrixCountryCode:
      env.discGolfMetrixCountryCode ??
      normalizeOptionalEnvValue(bindings.DISCGOLFMETRIX_COUNTRY_CODE) ??
      normalizeOptionalEnvValue(localBuildEnv.__LOCAL_DISCGOLFMETRIX_COUNTRY_CODE__),
    discGolfMetrixApiCode:
      env.discGolfMetrixApiCode ??
      normalizeOptionalEnvValue(bindings.DISCGOLFMETRIX_API_CODE) ??
      normalizeOptionalEnvValue(localBuildEnv.__LOCAL_DISCGOLFMETRIX_API_CODE__),
  };
}

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
  scheduledRunner: typeof runScheduledUpdate = runScheduledUpdate,
): {
  fetch(
    request: Request,
    env: CloudflareAppShellEnv,
    ctx?: ExecutionContextLike,
  ): Promise<Response>;
  scheduled(
    controller: ScheduledControllerLike,
    env: CloudflareAppShellEnv,
    ctx: ExecutionContextLike,
  ): Promise<void>;
} {
  return {
    async fetch(
      request: Request,
      env: CloudflareAppShellEnv,
      ctx?: ExecutionContextLike,
    ): Promise<Response> {
      const resolvedEnv = resolveCloudflareAppShellEnv(env);

      if (shouldHandleWithApi(request)) {
        return appShellRuntimeStorage.run({ env: resolvedEnv, ctx }, () =>
          handler(request, resolvedEnv, ctx),
        );
      }

      return resolvedEnv.ASSETS.fetch(request);
    },
    async scheduled(
      controller: ScheduledControllerLike,
      env: CloudflareAppShellEnv,
      ctx: ExecutionContextLike,
    ): Promise<void> {
      const resolvedEnv = resolveCloudflareAppShellEnv(env);
      const handled = await appShellRuntimeStorage.run({ env: resolvedEnv, ctx }, () =>
        scheduledRunner(controller, resolvedEnv),
      );

      if (!handled) {
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
    },
  };
}
