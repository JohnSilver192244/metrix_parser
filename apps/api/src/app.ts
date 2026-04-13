import { getRegisteredRoutes, type ApiModuleDependencies } from "./modules";
import { configureApiReadCache } from "./lib/api-read-cache";
import { createRouter } from "./lib/router";

export function createApiRequestHandler(dependencies?: ApiModuleDependencies) {
  configureApiReadCache();
  return createRouter(getRegisteredRoutes(dependencies));
}
