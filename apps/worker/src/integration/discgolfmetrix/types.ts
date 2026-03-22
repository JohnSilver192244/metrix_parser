import type { UpdatePeriod } from "@metrix-parser/shared-types";

export interface DiscGolfMetrixSourceRecord {
  [key: string]: unknown;
}

export interface DiscGolfMetrixCompetitionsRequest {
  period: UpdatePeriod;
}

export interface DiscGolfMetrixCourseRequest {
  courseId: string;
}

export interface DiscGolfMetrixCompetitionQueryParams {
  content: "competitions";
  countryCode: string;
  apiCode: string;
  date1: string;
  date2: string;
}

export interface DiscGolfMetrixCourseQueryParams {
  content: "course";
  courseId: string;
  apiCode: string;
}

export interface DiscGolfMetrixRawCompetitionRecord extends DiscGolfMetrixSourceRecord {}

export interface DiscGolfMetrixRawCourseRecord extends DiscGolfMetrixSourceRecord {}

export interface DiscGolfMetrixCompetitionsPayload {
  competitions: DiscGolfMetrixRawCompetitionRecord[];
  [key: string]: unknown;
}

export interface DiscGolfMetrixCoursePayload extends DiscGolfMetrixRawCourseRecord {}

export interface DiscGolfMetrixCompetitionsResponse {
  sourceUrl: string;
  fetchedAt: string;
  records: DiscGolfMetrixRawCompetitionRecord[];
  rawPayload: DiscGolfMetrixCompetitionsPayload;
}

export interface DiscGolfMetrixCourseResponse {
  sourceUrl: string;
  fetchedAt: string;
  courseId: string;
  record: DiscGolfMetrixRawCourseRecord;
  rawPayload: DiscGolfMetrixCoursePayload;
}
