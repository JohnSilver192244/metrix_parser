import React, { type ReactNode } from "react";

import { resolveCompetitionResultsCompetitionId } from "./route-paths";
import { AdminUpdatesPage } from "../features/admin-updates/admin-updates-page";
import { CompetitionsPage } from "../features/competitions/competitions-page";
import { CoursesPage } from "../features/courses/courses-page";
import { PlayersPage } from "../features/players/players-page";
import { CompetitionResultsPage } from "../features/results/competition-results-page";

export interface AppRouteRenderContext {
  onNavigate: (pathname: string) => void;
}

export interface AppRouteDefinition {
  path: string;
  label: string;
  group: "admin" | "browse";
  title: string;
  description: string;
  render: (context: AppRouteRenderContext) => ReactNode;
  activePath?: string;
}

export const appRoutes: AppRouteDefinition[] = [
  {
    path: "/",
    label: "Обновления",
    group: "admin",
    title: "Административный контур",
    description: "Ручной запуск обновлений и контроль операций синхронизации.",
    render: () => <AdminUpdatesPage />,
  },
  {
    path: "/competitions",
    label: "Соревнования",
    group: "browse",
    title: "Список соревнований",
    description: "Просмотр сохранённых соревнований, загруженных через backend API.",
    render: ({ onNavigate }) => <CompetitionsPage onNavigate={onNavigate} />,
  },
  {
    path: "/courses",
    label: "Парки",
    group: "browse",
    title: "Список парков",
    description: "Просмотр park records и рассчитанного coursePar без повторных вычислений на клиенте.",
    render: () => <CoursesPage />,
  },
  {
    path: "/players",
    label: "Игроки",
    group: "browse",
    title: "Список игроков",
    description: "Просмотр идентификационных данных игроков без привязки к отдельным результатам.",
    render: () => <PlayersPage />,
  },
];

function resolveCompetitionResultsRoute(pathname: string): AppRouteDefinition | null {
  const competitionId = resolveCompetitionResultsCompetitionId(pathname);
  if (!competitionId) {
    return null;
  }

  return {
    path: pathname,
    label: "Результаты соревнования",
    group: "browse",
    title: "Результаты соревнования",
    description: "Просмотр итогов конкретного соревнования с отдельной сортировкой для DNF.",
    activePath: "/competitions",
    render: ({ onNavigate }) => (
      <CompetitionResultsPage
        competitionId={competitionId}
        onNavigate={onNavigate}
      />
    ),
  };
}

export function resolveAppRoute(pathname: string): AppRouteDefinition | null {
  return (
    appRoutes.find((route) => route.path === pathname) ??
    resolveCompetitionResultsRoute(pathname)
  );
}

export function getAppRoutesByGroup(
  group: AppRouteDefinition["group"],
): AppRouteDefinition[] {
  return appRoutes.filter((route) => route.group === group);
}
