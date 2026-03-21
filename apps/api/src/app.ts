import { getRegisteredRoutes } from "./modules";
import { createRouter } from "./lib/router";

export function createApiRequestHandler() {
  return createRouter(getRegisteredRoutes());
}
