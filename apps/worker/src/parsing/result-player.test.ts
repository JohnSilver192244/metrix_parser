import assert from "node:assert/strict";
import test from "node:test";

import { readResultEntries } from "./result-player";

test("readResultEntries keeps only fields relevant for player and result parsing", () => {
  const entries = readResultEntries({
    Competition: {
      Results: [
        {
          UserID: "player-1",
          Name: "Ivan Ivanov",
          Class: "MPO",
          Sum: 54,
          Diff: -6,
          Place: 1,
          Status: "OK",
          HugeNestedBlob: {
            deeply: {
              unused: true,
            },
          },
          AnotherUnusedField: "drop-me",
        },
      ],
    },
  });

  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0], {
    UserID: "player-1",
    Name: "Ivan Ivanov",
    Class: "MPO",
    Sum: 54,
    Diff: -6,
    Place: 1,
    Status: "OK",
  });
});

test("readResultEntries infers DNF from incomplete per-hole results when track count is known", () => {
  const entries = readResultEntries({
    Competition: {
      Tracks: [{ HoleNumber: 1 }, { HoleNumber: 2 }, { HoleNumber: 3 }],
      Results: [
        {
          UserID: "player-1",
          Name: "Ivan Ivanov",
          Sum: 54,
          Diff: -6,
          PlayerResults: [
            { Result: 3 },
            { Result: 4 },
          ],
        },
        {
          UserID: "player-2",
          Name: "Petr Petrov",
          Sum: 55,
          Diff: -5,
          PlayerResults: [
            { Result: 3 },
            { Result: 4 },
            { Result: "" },
          ],
        },
      ],
    },
  });

  assert.deepEqual(entries, [
    {
      UserID: "player-1",
      Name: "Ivan Ivanov",
      Sum: 54,
      Diff: -6,
      DNF: true,
    },
    {
      UserID: "player-2",
      Name: "Petr Petrov",
      Sum: 55,
      Diff: -5,
      DNF: true,
    },
  ]);
});

test("readResultEntries keeps completed players non-DNF when all holes are played", () => {
  const entries = readResultEntries({
    Competition: {
      Tracks: [{ HoleNumber: 1 }, { HoleNumber: 2 }, { HoleNumber: 3 }],
      Results: [
        {
          UserID: "player-3",
          Name: "Complete Player",
          Sum: 51,
          Diff: -9,
          PlayerResults: [
            { Result: 3 },
            { Result: 3 },
            { Result: 3 },
          ],
        },
      ],
    },
  });

  assert.deepEqual(entries, [
    {
      UserID: "player-3",
      Name: "Complete Player",
      Sum: 51,
      Diff: -9,
    },
  ]);
});
