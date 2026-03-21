import { getRegisteredRoutes, type ApiModuleDependencies } from "./modules";
import { createRouter } from "./lib/router";

export function createApiRequestHandler(dependencies?: ApiModuleDependencies) {
  return createRouter(getRegisteredRoutes(dependencies));
}
