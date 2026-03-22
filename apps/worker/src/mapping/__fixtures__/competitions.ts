import type { DiscGolfMetrixRawCompetitionRecord } from "../../integration/discgolfmetrix";

export const russianCompetitionFixture: DiscGolfMetrixRawCompetitionRecord = {
  competitionId: "101",
  competitionName: "Moscow Open",
  competitionDate: "2026-04-12",
  courseName: "Tiraz Park",
  recordType: "tournament",
  playersCount: 72,
  metrixId: "metrix-101",
  countryCode: "RU",
};

export const russianCompetitionByCountryNameFixture: DiscGolfMetrixRawCompetitionRecord = {
  competition_id: "102",
  name: "Saint Petersburg Cup",
  date: "13.04.2026",
  course_name: "Primorsky Park",
  record_type: "league",
  players_count: "54",
  metrix_id: "metrix-102",
  country: "Russia",
};

export const nonRussianCompetitionFixture: DiscGolfMetrixRawCompetitionRecord = {
  competitionId: "201",
  competitionName: "Tallinn Open",
  competitionDate: "2026-04-12",
  countryCode: "EE",
};

export const brokenRussianCompetitionFixture: DiscGolfMetrixRawCompetitionRecord = {
  competitionId: "301",
  competitionName: "Broken Russia Event",
  countryCode: "RU",
};
