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

test("readResultEntries marks player as DNF when at least one basket is not completed", () => {
  const entries = readResultEntries({
    Competition: {
      Tracks: [{ Number: "1" }, { Number: "2" }, { Number: "3" }],
      Results: [
        {
          UserID: "player-2",
          Name: "Petr Petrov",
          Class: "MPO",
          Sum: 10,
          Diff: 1,
          PlayerResults: [{ Result: "3" }, { Result: "" }, { Result: "4" }],
        },
      ],
    },
  });

  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0], {
    UserID: "player-2",
    Name: "Petr Petrov",
    Class: "MPO",
    Sum: 10,
    Diff: 1,
    DNF: true,
  });
});
