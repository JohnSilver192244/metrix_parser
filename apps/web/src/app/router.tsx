import React, { type ReactNode } from "react";

import {
  resolveCompetitionResultsCompetitionId,
  resolvePlayerId,
} from "./route-paths";
import { AdminUpdatesPage } from "../features/admin-updates/admin-updates-page";
import { CompetitionsPage } from "../features/competitions/competitions-page";
import { CoursesPage } from "../features/courses/courses-page";
import { PlayersPage } from "../features/players/players-page";
import { PlayerPage } from "../features/players/player-page";
import { CompetitionResultsPage } from "../features/results/competition-results-page";
import { SeasonConfigPage } from "../features/season-config/season-config-page";
import { TournamentCategoriesPage } from "../features/tournament-categories/tournament-categories-page";

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
  requiresAuth?: boolean;
}

export const appRoutes: AppRouteDefinition[] = [
  {
    path: "/",
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
    render: ({ onNavigate }) => <PlayersPage onNavigate={onNavigate} />,
  },
  {
    path: "/tournament-categories",
    label: "Категории турниров",
    group: "browse",
    title: "Категории турниров",
    description: "Просмотр и редактирование справочника категорий турниров с ограничением на запись по авторизации.",
    render: () => <TournamentCategoriesPage />,
  },
  {
    path: "/admin",
    label: "Обновления",
    group: "admin",
    title: "Административный контур",
    description: "Ручной запуск обновлений и контроль операций синхронизации.",
    render: () => <AdminUpdatesPage />,
    requiresAuth: true,
  },
  {
    path: "/season-config",
    label: "Сезоны и очки",
    group: "admin",
    title: "Конфигурация сезона",
    description:
      "Редактирование диапазонов дат сезона и правил начисления очков по местам.",
    render: () => <SeasonConfigPage />,
    requiresAuth: true,
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
    activePath: "/",
    render: ({ onNavigate }) => (
      <CompetitionResultsPage
        competitionId={competitionId}
        onNavigate={onNavigate}
      />
    ),
  };
}

function resolvePlayerRoute(pathname: string): AppRouteDefinition | null {
  const playerId = resolvePlayerId(pathname);
  if (!playerId) {
    return null;
  }

  return {
    path: pathname,
    label: "Игрок",
    group: "browse",
    title: "Карточка игрока",
    description: "Просмотр результатов игрока по соревнованиям, сезону и выбранному периоду.",
    activePath: "/players",
    render: ({ onNavigate }) => <PlayerPage playerId={playerId} onNavigate={onNavigate} />,
  };
}

export function resolveAppRoute(pathname: string): AppRouteDefinition | null {
  return (
    appRoutes.find((route) => route.path === pathname) ??
    resolveCompetitionResultsRoute(pathname) ??
    resolvePlayerRoute(pathname)
  );
}

export function getAppRoutesByGroup(
  group: AppRouteDefinition["group"],
): AppRouteDefinition[] {
  return appRoutes.filter((route) => route.group === group);
}
