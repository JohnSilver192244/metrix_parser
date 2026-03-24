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
