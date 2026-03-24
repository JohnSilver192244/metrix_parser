export interface Competition {
  competitionId: string;
  competitionName: string;
  competitionDate: string;
  parentId?: string | null;
  courseId?: string | null;
  courseName: string | null;
  recordType: string | null;
  playersCount: number | null;
  metrixId: string | null;
}

export interface CompetitionDbRecord {
  competition_id: string;
  competition_name: string;
  competition_date: string;
  parent_id?: string | null;
  course_id: string | null;
  course_name: string | null;
  record_type: string | null;
  players_count: number | null;
  metrix_id: string | null;
}

export function toCompetitionDbRecord(
  competition: Competition,
): CompetitionDbRecord {
  return {
    competition_id: competition.competitionId,
    competition_name: competition.competitionName,
    competition_date: competition.competitionDate,
    parent_id: competition.parentId ?? null,
    course_id: competition.courseId ?? null,
    course_name: competition.courseName,
    record_type: competition.recordType,
    players_count: competition.playersCount,
    metrix_id: competition.metrixId,
  };
}
