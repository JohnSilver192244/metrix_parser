import type { ReactNode } from "react";

import { AdminUpdatesPage } from "../features/admin-updates/admin-updates-page";

export interface AppRouteDefinition {
  path: string;
  label: string;
  element: ReactNode;
}

export const appRoutes: AppRouteDefinition[] = [
  {
    path: "/",
    label: "Обновления",
    element: <AdminUpdatesPage />,
  },
];

export function resolveAppRoute(pathname: string): AppRouteDefinition | null {
  return appRoutes.find((route) => route.path === pathname) ?? null;
}
