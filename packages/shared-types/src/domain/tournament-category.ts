export type CompetitionClass = "league" | "tournament" | "championship";

export interface TournamentCategory {
  categoryId: string;
  name: string;
  description: string;
  competitionClass: CompetitionClass;
  segmentsCount: number;
  ratingGte: number;
  ratingLt: number;
  coefficient: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface TournamentCategoryDbRecord {
  category_id: string;
  name: string;
  description: string;
  competition_class: CompetitionClass;
  segments_count: number;
  rating_gte: number;
  rating_lt: number;
  coefficient: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateTournamentCategoryRequest {
  name: string;
  description: string;
  competitionClass: CompetitionClass;
  segmentsCount: number;
  ratingGte: number;
  ratingLt: number;
  coefficient: number;
}

export interface UpdateTournamentCategoryRequest {
  categoryId: string;
  name: string;
  description: string;
  competitionClass: CompetitionClass;
  segmentsCount: number;
  ratingGte: number;
  ratingLt: number;
  coefficient: number;
}

export interface DeleteTournamentCategoryRequest {
  categoryId: string;
}

export function toTournamentCategoryDbRecord(
  category: TournamentCategory,
): TournamentCategoryDbRecord {
  return {
    category_id: category.categoryId,
    name: category.name,
    description: category.description,
    competition_class: category.competitionClass,
    segments_count: category.segmentsCount,
    rating_gte: category.ratingGte,
    rating_lt: category.ratingLt,
    coefficient: category.coefficient,
    created_at: category.createdAt,
    updated_at: category.updatedAt,
  };
}
