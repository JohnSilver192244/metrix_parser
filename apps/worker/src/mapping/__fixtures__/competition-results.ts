import type { DiscGolfMetrixResultsResponse } from "../../integration/discgolfmetrix";

export const regularCompetitionResultsFixture: DiscGolfMetrixResultsResponse = {
  sourceUrl: "https://discgolfmetrix.com/api.php?content=result&id=competition-101",
  fetchedAt: "2026-03-22T10:00:00.000Z",
  competitionId: "competition-101",
  metrixId: "metrix-101",
  record: {
    Competition: {
      Results: [
        {
          UserID: "player-1",
          Name: "Ivan Ivanov",
          Class: "MPO",
          Sum: 54,
          Diff: -6,
          Place: 1,
        },
      ],
    },
  },
  rawPayload: {
    Competition: {
      Results: [
        {
          UserID: "player-1",
          Name: "Ivan Ivanov",
          Class: "MPO",
          Sum: 54,
          Diff: -6,
          Place: 1,
        },
      ],
    },
  },
};

export const dnfCompetitionResultsFixture: DiscGolfMetrixResultsResponse = {
  sourceUrl: "https://discgolfmetrix.com/api.php?content=result&id=competition-102",
  fetchedAt: "2026-03-22T10:05:00.000Z",
  competitionId: "competition-102",
  metrixId: null,
  record: {
    Competition: {
      Results: [
        {
          UserID: "player-2",
          Name: "Petr Petrov",
          Class: "MA3",
          Place: 17,
          DNF: true,
        },
      ],
    },
  },
  rawPayload: {
    Competition: {
      Results: [
        {
          UserID: "player-2",
          Name: "Petr Petrov",
          Class: "MA3",
          Place: 17,
          DNF: true,
        },
      ],
    },
  },
};

export const incompleteCompetitionResultsFixture: DiscGolfMetrixResultsResponse = {
  sourceUrl: "https://discgolfmetrix.com/api.php?content=result&id=competition-103",
  fetchedAt: "2026-03-22T10:10:00.000Z",
  competitionId: "competition-103",
  metrixId: "metrix-103",
  record: {
    Competition: {
      Results: [
        {
          UserID: "player-3",
          Name: "Sergey Sidorov",
          Class: "MPO",
          Place: 3,
        },
      ],
    },
  },
  rawPayload: {
    Competition: {
      Results: [
        {
          UserID: "player-3",
          Name: "Sergey Sidorov",
          Class: "MPO",
          Place: 3,
        },
      ],
    },
  },
};
