import type { Competition } from "../domain";
import type { CompetitionResult } from "../domain";
import type { Course } from "../domain";
import type { Player } from "../domain";

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

export interface CoursesListMeta extends ApiMeta {
  count: number;
}

export type CoursesListResponse = Course[];

export interface PlayersListMeta extends ApiMeta {
  count: number;
}

export type PlayersListResponse = Player[];

export interface ResultsListMeta extends ApiMeta {
  count: number;
}

export type ResultsListResponse = CompetitionResult[];
