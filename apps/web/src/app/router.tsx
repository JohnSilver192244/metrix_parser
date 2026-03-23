import React, { type ReactNode } from "react";

import { AdminUpdatesPage } from "../features/admin-updates/admin-updates-page";
import { CompetitionsPage } from "../features/competitions/competitions-page";
import { CoursesPage } from "../features/courses/courses-page";
import { PlayersPage } from "../features/players/players-page";
import { ResultsPage } from "../features/results/results-page";

export interface AppRouteDefinition {
  path: string;
  label: string;
  group: "admin" | "browse";
  title: string;
  description: string;
  element: ReactNode;
}

export const appRoutes: AppRouteDefinition[] = [
  {
    path: "/",
    label: "Обновления",
    group: "admin",
    title: "Административный контур",
    description: "Ручной запуск обновлений и контроль операций синхронизации.",
    element: <AdminUpdatesPage />,
  },
  {
    path: "/competitions",
    label: "Соревнования",
    group: "browse",
    title: "Список соревнований",
    description: "Просмотр сохранённых соревнований, загруженных через backend API.",
    element: <CompetitionsPage />,
  },
  {
    path: "/courses",
    label: "Парки",
    group: "browse",
    title: "Список парков",
    description: "Просмотр park records и рассчитанного coursePar без повторных вычислений на клиенте.",
    element: <CoursesPage />,
  },
  {
    path: "/players",
    label: "Игроки",
    group: "browse",
    title: "Список игроков",
    description: "Просмотр идентификационных данных игроков без привязки к отдельным результатам.",
    element: <PlayersPage />,
  },
  {
    path: "/results",
    label: "Результаты",
    group: "browse",
    title: "Результаты соревнований",
    description: "Просмотр итогов выступлений с отдельным состоянием для DNF.",
    element: <ResultsPage />,
  },
];

export function resolveAppRoute(pathname: string): AppRouteDefinition | null {
  return appRoutes.find((route) => route.path === pathname) ?? null;
}

export function getAppRoutesByGroup(
  group: AppRouteDefinition["group"],
): AppRouteDefinition[] {
  return appRoutes.filter((route) => route.group === group);
}
