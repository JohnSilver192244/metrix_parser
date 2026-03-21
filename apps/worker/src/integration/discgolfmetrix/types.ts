import type { UpdatePeriod } from "@metrix-parser/shared-types";

export interface DiscGolfMetrixCompetitionsRequest {
  period: UpdatePeriod;
}

export interface DiscGolfMetrixCompetitionQueryParams {
  content: "competitions";
  countryCode: string;
  apiCode: string;
  date1: string;
  date2: string;
}

export interface DiscGolfMetrixRawCompetitionRecord {
  [key: string]: unknown;
}

export interface DiscGolfMetrixCompetitionsPayload {
  competitions: DiscGolfMetrixRawCompetitionRecord[];
  [key: string]: unknown;
}

export interface DiscGolfMetrixCompetitionsResponse {
  sourceUrl: string;
  fetchedAt: string;
  records: DiscGolfMetrixRawCompetitionRecord[];
  rawPayload: DiscGolfMetrixCompetitionsPayload;
}
