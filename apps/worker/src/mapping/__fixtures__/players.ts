import type { DiscGolfMetrixResultsResponse } from "../../integration/discgolfmetrix";

export const multiPlayerResultsFixture: DiscGolfMetrixResultsResponse = {
  sourceUrl: "https://discgolfmetrix.com/api.php?content=result&id=competition-101",
  fetchedAt: "2026-03-22T10:00:00.000Z",
  competitionId: "competition-101",
  metrixId: "metrix-101",
  record: {
    Competition: {
      Results: [
        { UserID: "player-1", Name: "Ivan Ivanov", Place: 1 },
        { UserID: "player-2", Name: "Petr Petrov", Place: 2 },
      ],
    },
  },
  rawPayload: {
    Competition: {
      Results: [
        { UserID: "player-1", Name: "Ivan Ivanov", Place: 1 },
        { UserID: "player-2", Name: "Petr Petrov", Place: 2 },
      ],
    },
  },
};

export const repeatedPlayerResultsFixture: DiscGolfMetrixResultsResponse = {
  sourceUrl: "https://discgolfmetrix.com/api.php?content=result&id=competition-102",
  fetchedAt: "2026-03-22T10:05:00.000Z",
  competitionId: "competition-102",
  metrixId: null,
  record: {
    Competition: {
      Results: [
        { UserID: "player-1", Name: "Ivan S. Ivanov", Place: 4 },
        { UserID: "player-3", Name: "Sergey Sidorov", Place: 7 },
      ],
    },
  },
  rawPayload: {
    Competition: {
      Results: [
        { UserID: "player-1", Name: "Ivan S. Ivanov", Place: 4 },
        { UserID: "player-3", Name: "Sergey Sidorov", Place: 7 },
      ],
    },
  },
};

export const incompletePlayerResultsFixture: DiscGolfMetrixResultsResponse = {
  sourceUrl: "https://discgolfmetrix.com/api.php?content=result&id=competition-103",
  fetchedAt: "2026-03-22T10:10:00.000Z",
  competitionId: "competition-103",
  metrixId: "metrix-103",
  record: {
    Competition: {
      Results: [
        { UserID: "player-4" },
        { Name: "Nameless Id" },
      ],
    },
  },
  rawPayload: {
    Competition: {
      Results: [
        { UserID: "player-4" },
        { Name: "Nameless Id" },
      ],
    },
  },
};
