import type { Competition } from "../domain";
import type { CompetitionResult } from "../domain";
import type { Course } from "../domain";
import type { Division } from "../domain";
import type { Player } from "../domain";
import type { PlayerCompetitionResult } from "../domain";
import type { Season } from "../domain";
import type {
  RunSeasonPointsAccrualRequest,
  RunSeasonPointsAccrualResult,
} from "../domain";
import type { SeasonPointsEntry } from "../domain";
import type { TournamentCategory } from "../domain";
import type { AppUser, AuthSession } from "../domain";
import type { CreateSeasonPointsEntryRequest } from "../domain";
import type { CreateSeasonRequest } from "../domain";
import type { DeleteSeasonPointsEntryRequest } from "../domain";
import type { DeleteSeasonRequest } from "../domain";
import type { UpdateCompetitionCategoryRequest } from "../domain";
import type { UpdateSeasonPointsEntryRequest } from "../domain";
import type { UpdateSeasonRequest } from "../domain";

export interface ApiMeta {
  [key: string]: unknown;
}

export interface ApiEnvelope<TData, TMeta extends ApiMeta = ApiMeta> {
  data: TData;
  meta?: TMeta;
}

export interface ApiErrorDetails {
  code: string;
  message: string;
}

export interface ApiErrorEnvelope {
  error: ApiErrorDetails;
}

export interface CompetitionsListMeta extends ApiMeta {
  count: number;
}

export type CompetitionsListResponse = Competition[];
export type UpdateCompetitionCategoryResponse = Competition;
export type UpdateCompetitionCategoryApiRequest = UpdateCompetitionCategoryRequest;

export interface CoursesListMeta extends ApiMeta {
  count: number;
}

export type CoursesListResponse = Course[];

export interface PlayersListMeta extends ApiMeta {
  count: number;
}

export type PlayersListResponse = Player[];

export interface PlayerResultsListMeta extends ApiMeta {
  count: number;
}

export type PlayerResultsListResponse = PlayerCompetitionResult[];

export interface DivisionsListMeta extends ApiMeta {
  count: number;
}

export type DivisionsListResponse = Division[];

export interface ResultsListMeta extends ApiMeta {
  count: number;
}

export type ResultsListResponse = CompetitionResult[];

export type AuthSessionResponse = AuthSession;

export interface UsersListMeta extends ApiMeta {
  count: number;
}

export type UsersListResponse = AppUser[];

export interface TournamentCategoriesListMeta extends ApiMeta {
  count: number;
}

export type TournamentCategoriesListResponse = TournamentCategory[];

export interface SeasonsListMeta extends ApiMeta {
  count: number;
}

export type SeasonsListResponse = Season[];
export type CreateSeasonApiRequest = CreateSeasonRequest;
export type UpdateSeasonApiRequest = UpdateSeasonRequest;
export type DeleteSeasonApiRequest = DeleteSeasonRequest;
export type CreateSeasonResponse = Season;
export type UpdateSeasonResponse = Season;

export interface SeasonPointsTableListMeta extends ApiMeta {
  count: number;
}

export type SeasonPointsTableListResponse = SeasonPointsEntry[];
export type CreateSeasonPointsEntryApiRequest = CreateSeasonPointsEntryRequest;
export type UpdateSeasonPointsEntryApiRequest = UpdateSeasonPointsEntryRequest;
export type DeleteSeasonPointsEntryApiRequest = DeleteSeasonPointsEntryRequest;
export type CreateSeasonPointsEntryResponse = SeasonPointsEntry;
export type UpdateSeasonPointsEntryResponse = SeasonPointsEntry;

export type RunSeasonPointsAccrualApiRequest = RunSeasonPointsAccrualRequest;
export type RunSeasonPointsAccrualResponse = RunSeasonPointsAccrualResult;
