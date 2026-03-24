import type { DiscGolfMetrixRawCompetitionRecord } from "../../integration/discgolfmetrix";

export const russianCompetitionFixture: DiscGolfMetrixRawCompetitionRecord = {
  ID: 101,
  Name: "Moscow Open",
  Date: "2026-04-12",
  ParentID: 9001,
  CourseID: "45374",
  Coursename: "Tiraz Park",
  RecordType: 4,
  PlayersCount: 72,
  CountryCode: "RU",
};

export const russianCompetitionByCountryNameFixture: DiscGolfMetrixRawCompetitionRecord = {
  competition_id: "102",
  Name: "Saint Petersburg Cup",
  Date: "13.04.2026",
  CourseID: "45375",
  Coursename: "Primorsky Park",
  RecordType: "2",
  PlayersCount: "54",
  Country: "Russia",
};

export const nonRussianCompetitionFixture: DiscGolfMetrixRawCompetitionRecord = {
  ID: "201",
  Name: "Tallinn Open",
  Date: "2026-04-12",
  CountryCode: "EE",
};

export const brokenRussianCompetitionFixture: DiscGolfMetrixRawCompetitionRecord = {
  ID: "301",
  Name: "Broken Event",
  CountryCode: "RU",
};

export const russianCompetitionWithoutCountryMetadataFixture: DiscGolfMetrixRawCompetitionRecord = {
  ID: "401",
  Name: "League Round",
  Date: "2026-03-22",
  CourseID: "45376",
  CourseName: "Palace of Pioneers",
  RecordType: "2",
  PlayersCount: "10",
};
