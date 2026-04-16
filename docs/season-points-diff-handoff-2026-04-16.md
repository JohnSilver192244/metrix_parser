# Handoff: season points and hierarchy logic from current `main` diff

## Purpose

This document explains the logic behind the current uncommitted diff on `main` so the same behavior can be reimplemented or preserved in a later refactor branch without rereading the whole patch.

The diff is not a single isolated fix. It changes four connected areas:

1. Worker parsing now infers `DNF` when Disc Golf Metrix round payloads are structurally incomplete.
2. API hierarchy loading now expands both upward to parents and downward to siblings/descendants so owner competition resolution stays correct when the seed set contains only a subset of rounds.
3. Season points accrual now chooses the matrix row by `players_count - unique_dnf_players`, not by raw ranked finisher count and not by the original competition size when some players explicitly did not finish.
4. A generator and SQL migration refresh the season points matrix for seasons `2025` and `2026`.

## Why this diff exists

Two scoring problems were being mixed together:

1. Some Metrix result payloads did not mark `DNF` explicitly even though one or more baskets were missing from `PlayerResults`.
2. Season points lookup could land on the wrong matrix row because the scoring layer used the wrong effective field size.

The intended behavior after this diff is:

- missing hole results should be treated as `DNF`
- `DNF` players should not count as valid field participants for matrix lookup
- but matrix lookup should still not collapse all the way to the number of ranked finishers if the event had more players than that
- owner competition resolution for child rounds must remain consistent with the list/detail hierarchy model, even when only one pool's rounds are initially loaded

## Worker-side DNF inference

Files:

- `apps/worker/src/parsing/result-player.ts`
- `apps/worker/src/parsing/result-player.test.ts`
- `apps/worker/src/mapping/competition-results.test.ts`

### New rule

When the payload contains a known number of tracks/holes and a player's `PlayerResults` collection is shorter than that track count, or contains an empty result for any expected hole, the player should be treated as `DNF`.

### How it is implemented

`readResultEntries` now:

- reads track count from either `Competition.Tracks` or top-level `Tracks`
- reads per-player hole results from `PlayerResults`, `playerResults`, or `player_results`
- treats a hole as completed only when `Result`/`result`/`Score`/`score` is present and non-empty
- injects `DNF: true` into the projected record when the round is structurally incomplete

### Important invariant

This is not a placement-based heuristic. The code does not infer `DNF` from rank, total score, or missing class. It only infers `DNF` from incomplete per-hole data when expected track count is known.

### Small parser detail

`Place` and `place` were added to `RELEVANT_RESULT_RECORD_FIELDS`. That keeps placement information available in the projected record set when present in source payloads.

## Shared competition hierarchy expansion

Files:

- `apps/api/src/modules/competition-hierarchy.ts`
- `apps/api/src/modules/players/index.ts`
- `apps/api/src/modules/results/index.ts`
- `apps/api/src/app.test.ts`

### Problem

The old hierarchy loaders in `players` and `results` only walked upward from seed competitions to parents.

That breaks owner resolution when the caller seeds the hierarchy with only some child rounds. Example:

- Event `event-100`
- Pools `pool-long` and `pool-short`
- Rounds under each pool

If the seed contains only `round-long-1` and `round-long-2`, upward traversal finds `pool-long` and `event-100`, but it does not learn that `event-100` has multiple pools. Without that sibling knowledge the owner resolver can incorrectly promote those rounds to the event instead of keeping them owned by `pool-long`.

### New loader behavior

`loadCompetitionHierarchyContext` now does two passes:

1. Upward expansion: load seed competitions, then keep loading their parents until the chain ends.
2. Downward expansion: for every loaded competition, load its children by `parent_id`, then recursively expand those children too.

This produces a local hierarchy closure around the seed set, not just a parent chain.

### Why the downward pass matters

Owner resolution depends on knowing whether an event has:

- a single pool, where rounds can still resolve to the event owner
- multiple pools, where rounds must stay attached to their specific pool owner

The tests added to `apps/api/src/app.test.ts` lock both cases:

- multi-pool event seeded from one pool's rounds must resolve to the pool owner
- single-pool event seeded from round rows must resolve to the event owner

### Refactor note

The new shared loader is not an optimization-only extraction. The semantic change is the descendant expansion. A refactor that keeps only the shared helper but drops the second pass will reintroduce the bug.

## Season points matrix row selection

Files:

- `apps/api/src/modules/season-standings/index.ts`
- `apps/api/src/app.test.ts`

### Old behavior

`resolveSeasonPointsPlayersCount` returned:

`max(normalizedCompetitionPlayersCount, rankedResultsCount)`

This preserved the larger of official competition size and number of ranked finishers, but it ignored explicit `DNF` participants.

### New behavior

`resolveSeasonPointsPlayersCount` now receives the full `competitionResults` collection and returns:

`max(normalizedCompetitionPlayersCount - unique_dnf_players, rankedResultsCount)`

where `unique_dnf_players` is the count of unique `player_id` values with `dnf === true`.

### Why this change exists

If a competition had `42` players but one player is `DNF`, the effective matrix row should be `41`, not:

- `42`, because the DNF player should not inflate the effective field for season points
- and not `3`, if only three players remain ranked in a reduced sample

The tests were updated to lock the `42 -> 41` case:

- row 1 points become `78.5` instead of `80`
- row 2 points become `70` instead of `72`
- row 3 points become `64` instead of `65`

and the resulting season totals change accordingly.

### Important invariant

This diff intentionally subtracts only explicit `DNF` players. It does not subtract every missing finisher and does not recompute field size from `rankedResults.length` alone.

That distinction matters because the project rules require matrix lookup to remain tied to the scoring competition's official size, except for the now-supported case where players are explicitly known `DNF`.

## Season points matrix refresh tooling

Files:

- `scripts/generate-season-points-migration.mjs`
- `scripts/generate-season-points-migration.test.mjs`
- `supabase/migrations/0027_refresh_season_points_matrix_2025_2026.sql`
- `package.json`

### What was added

A small generator script converts a triangular CSV matrix into SQL that:

- ensures seasons `2025` and `2026` exist
- deletes existing `season_standings` rows for those seasons
- deletes existing `season_points_table` rows for those seasons
- inserts the same generated matrix for both seasons

`package.json` adds:

`generate:season-points-migration`

so the generator can be rerun from npm scripts.

### CSV parsing rules

The generator expects:

- header row with `players_count` columns after the first cell
- first column in each data row to be `placement`
- triangular data: blank cells are allowed only when `placement > players_count`

It fails fast when:

- row width does not match the header
- a required point is missing
- a point exists outside the valid triangular region
- integer or point parsing fails

### Important test caveat

`scripts/generate-season-points-migration.test.mjs` currently reads a fixture from an absolute path in `~/Downloads`.

That test passes in the current local environment but is not portable as-is. If this logic is kept long-term, the fixture should be moved into the repository.

## Files that belong to this logical change

Product files on `main`:

- `apps/api/src/app.test.ts`
- `apps/api/src/modules/competition-hierarchy.ts`
- `apps/api/src/modules/players/index.ts`
- `apps/api/src/modules/results/index.ts`
- `apps/api/src/modules/season-standings/index.ts`
- `apps/worker/src/mapping/competition-results.test.ts`
- `apps/worker/src/parsing/result-player.test.ts`
- `apps/worker/src/parsing/result-player.ts`
- `scripts/generate-season-points-migration.mjs`
- `scripts/generate-season-points-migration.test.mjs`
- `supabase/migrations/0027_refresh_season_points_matrix_2025_2026.sql`
- `package.json`
- this handoff document

Noise that does not belong to the product change:

- `.omx/**`
- `apps/web/.wrangler/**`

## Branch sync rule used here

When copying this change to the deploy-specific branches:

- `main` should keep the full product diff, including `package.json`
- `amvera-api` and `amvera-web` should receive the code, tests, migration, and handoff doc
- config/service noise must stay out
- if "without config" is interpreted strictly, exclude `package.json` from the branch-sync step even though it is useful on `main`

## Minimal verification expected after replay

At minimum, preserve these outcomes:

1. Incomplete `PlayerResults` causes `DNF` inference.
2. Multi-pool events seeded from a subset of rounds still resolve to pool ownership.
3. Single-pool events seeded from rounds still resolve to event ownership.
4. Season points matrix lookup uses `competition_players_count - unique_dnf_players`.
5. Migration generator still emits the same two-season matrix SQL.
