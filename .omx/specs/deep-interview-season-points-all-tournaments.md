# Deep Interview Spec — Season points for all tournaments with transparent counted points

## Metadata
- Profile: standard
- Rounds: 6
- Final ambiguity: 0.16
- Threshold: 0.20
- Context type: brownfield
- Context snapshot: `.omx/context/unspecified-task-20260402T184633Z.md`
- Transcript: `.omx/interviews/season-points-all-tournaments-20260402T184633Z.md`

## Clarity Breakdown
| Dimension | Score |
|---|---:|
| Intent | 0.90 |
| Outcome | 0.88 |
| Scope | 0.85 |
| Constraints | 0.78 |
| Success | 0.90 |
| Context | 0.80 |

## Intent
Исправить сезонное начисление очков так, чтобы игроки получали очки за все турниры, а не только за ограниченный набор лучших турниров. Дополнительно система должна стать прозрачной: игрок должен видеть и общую сумму заработанных очков, и ту часть, которая идет в зачет сезона.

## Desired Outcome
### 1) Player page
For a selected season, show all competitions with points.
- Top block: competitions that count toward standings (“best” entries).
- Then a separator/divider.
- Then remaining competitions with their points.
- “Best” entries are chosen by highest points.
- Number of counted entries is taken from season parameters.

### 2) Players list page
For a selected season, show two separate columns:
- `Сумма очков` — sum of all earned points across all competitions in the season.
- `Очки в зачете` — sum of the best N entries for that season.

### 3) Season filter behavior
Both pages continue using a single-select season filter. Mixed-season aggregation in the same view is not required.

## In Scope
- Change season-points logic so all tournaments accrue points.
- Preserve a separate “counted points” concept based on top N entries from season parameters.
- Update backend and frontend code as needed.
- Update internal API / TypeScript models if needed, while preserving backward compatibility.
- Support manual verification by rerunning accrual with overwrite enabled.

## Out of Scope / Non-goals
- No DB schema/table changes.
- No automatic migration/backfill of existing season data.
- No multi-season combined view.

## Decision Boundaries
- OMX may make any code-level decisions without further confirmation.
- OMX may not change DB tables/schema in this task.
- Backward compatibility is required.

## Constraints
- Existing DB tables must remain unchanged.
- Old data can be refreshed only through existing manual accrual rerun with overwrite.
- Backward compatibility must be maintained for existing consumers.
- Best-N count must come from season configuration.

## Testable Acceptance Criteria
1. After accrual for a season, points are generated for all eligible tournaments, not only the previous best-4 subset.
2. Players list for a selected season shows:
   - total points = sum of all earned season points;
   - counted points = sum of strictly N best entries.
3. Player page for a selected season shows all competitions and visually separates counted entries from non-counted entries.
4. The number of counted entries uses season settings.
5. Tie-break rule at the cutoff is deterministic:
   - strictly N entries count;
   - if points tie, prefer higher category;
   - if category also ties, prefer competition with more players.
6. Season filter remains single-select on both pages.
7. No DB schema changes are introduced.
8. Existing overwrite-based accrual rerun can be used by the user to refresh old data manually and validate the behavior.

## Assumptions Exposed + Resolutions
- Assumption: old data needs migration.
  - Resolution: rejected; manual rerun with overwrite is sufficient.
- Assumption: transparency only requires changing the total.
  - Resolution: rejected; UI must explicitly show both all-earned and counted points in two places.
- Assumption: ties at the cutoff can be arbitrary.
  - Resolution: rejected; explicit tie-break rules are required.

## Pressure-pass Findings
The migration question was explicitly pressure-tested. The accepted boundary is to avoid auto-migration and rely on manual overwrite reruns.

## Brownfield Evidence vs Inference Notes
### Evidence
- `apps/web/src/features/players/player-page.tsx` already has a single season filter.
- `apps/api/src/modules/players/index.ts` currently aggregates one `season_points` total per player from `season_standings`.
- `apps/api/src/modules/players/index.ts` currently provides one `seasonPoints` value per competition on the player page.
- `apps/web/src/features/season-config/season-config-page.tsx` already supports season accrual rerun with overwrite.
- `packages/shared-types/src/domain/season.ts` includes season-level best-count settings.

### Inference
- Implementation will likely require either additive response fields or derived client-side grouping/sums while keeping existing fields compatible.
- Best-N selection may need enrichment with category/player-count metadata during accrual or read-side aggregation without changing DB schema.

## Technical Context Findings
Likely touchpoints:
- `apps/api/src/modules/season-standings/*`
- `apps/api/src/modules/players/index.ts`
- `packages/shared-types/src/domain/*`
- `apps/web/src/features/players/player-page.tsx`
- `apps/web/src/features/players/players-page.tsx`
- related tests in `apps/api/src/app.test.ts`, `apps/web/src/features/players/*.test.tsx`, and season standings tests.

## Condensed Transcript
See transcript artifact for round-by-round summary.
