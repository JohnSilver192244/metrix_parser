# PRD — Season points for all tournaments with transparent counted points

## Problem statement
Players currently cannot clearly see the difference between:
- all points they earned across a season, and
- the subset of points that count toward the season standings.

The current system also implies a “best 4” style limit, while the desired behavior is:
- accrue points for all eligible tournaments,
- display all earned points transparently,
- keep only the best N entries in the season score,
- and do so without changing DB schema.

## Goals
1. Accrue season points for all eligible tournaments.
2. Show both:
   - total earned points, and
   - counted points in season standings.
3. Keep player-facing views transparent:
   - player page shows counted rows above a divider, then non-counted rows,
   - players list shows `Сумма очков` and `Очки в зачете`.
4. Preserve backward compatibility for existing API/UI consumers.
5. Keep all changes code-only; no DB schema/table changes.
6. Allow manual refresh of old data through the existing overwrite accrual flow.

## Non-goals
- No DB schema changes.
- No automatic migration/backfill of historical season data.
- No multi-season combined view.
- No redesign of unrelated screens.

## User-facing behavior
### Player page
- Single season filter remains.
- The table shows all competitions for the selected season.
- Counted competitions appear first.
- Then a visible separator.
- Then the remaining competitions.
- Each competition still shows its points.

### Players list
- Single season filter remains.
- Two point columns are visible:
  - total points across all season competitions,
  - counted points for the best N entries.

## Data / API behavior
- Use one shared pure ranking helper in the API domain layer as the single source of truth for:
  - best N selection,
  - tie-break order,
  - counted vs non-counted marking,
  - counted vs total sum derivation.
- Helper placement: API-side shared logic under the season-standings / players read-model boundary so both accrual-related logic and player-facing read-side assembly use the same comparator and selection routine.
- Frontend must not derive best-N on its own; backend computes counted flags and counted totals, frontend only renders.
- Preserve existing fields where possible.
- Add explicit backward-compatible fields where transparency requires it.
- Do not change DB tables.

## Endpoint contract plan
### Players list (`GET /players?seasonCode=...`)
- Preserve existing `seasonPoints` field as the legacy total field for backward compatibility.
- Add additive `countedSeasonPoints` field for the sum of strictly N counted entries.
- Preserve `competitionsCount`.

### Player results (`GET /players/results?...`)
- Preserve existing `seasonPoints` per competition row.
- Add additive `isCountedInSeason` boolean.
- Add additive ranking metadata only if needed for deterministic rendering/debuggability; prefer keeping category rank and players count internal unless tests or diagnostics require exposure.

### Ownership of ranking truth
- Backend owns:
  - best-N selection,
  - cutoff tie-break resolution,
  - total points sum,
  - counted points sum,
  - per-row counted flag.
- Frontend owns:
  - rendering counted rows first,
  - inserting a divider between counted and non-counted rows,
  - displaying total vs counted columns.

## Ranking rules
Count strictly N entries, where N comes from season settings.

Tie-break on the cutoff:
1. higher points wins,
2. if points are equal, higher category wins, where category order is based on the persisted tournament-category `coefficient` (higher coefficient = higher category),
3. if category is equal, higher players count wins.

If all three values are equal, retain a stable deterministic fallback in code (for example by competition id) so the helper stays predictable in tests.

## Backward compatibility requirements
- Existing consumers must continue to work.
- New fields should be additive and explicit.
- Legacy field meaning must be preserved and documented in the implementation plan.
- `Player.seasonPoints` remains the legacy total season sum.
- Per-competition `PlayerCompetitionResult.seasonPoints` remains the earned points for that competition.
- New counted-specific information must be carried in additive fields rather than by redefining legacy fields.

## Rollout / refresh note
Old season data will not be auto-migrated.
The user will manually rerun season accrual with overwrite enabled to refresh the season standings and verify the fix.

## Acceptance criteria
1. Season accrual produces points for all eligible tournaments.
2. Players list shows total points and counted points separately.
3. Player page visibly separates counted and non-counted competitions.
4. The best-N rule is deterministic using the defined tie-break order.
5. Existing API consumers still receive compatible fields.
6. No DB schema changes are introduced.
7. Manual overwrite rerun remains available and sufficient for refreshing old data.

## Risks
1. Legacy field ambiguity: consumers may rely on the old meaning of `seasonPoints`.
2. Ranking drift: if tie-break logic is duplicated, read-side and write-side can diverge.
3. Read-side complexity: transparency may increase API shape complexity.
4. Verification gap: old data remains stale until manual overwrite rerun.

## Recommended implementation approach
Use a single shared pure ranking helper, called from both read-side aggregation paths, and expose explicit additive fields for counted totals and counted flags while leaving legacy `seasonPoints` semantics intact. The helper comparator must be: season points desc → category coefficient desc → players count desc → stable deterministic fallback. The backend computes all ranking outcomes; the frontend only renders the supplied flags/totals.
