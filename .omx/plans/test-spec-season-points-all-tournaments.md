# Test Spec — Season points for all tournaments with transparent counted points

## Scope of verification
Verify that the season points system:
- accrues points for all tournaments,
- distinguishes total points from counted points,
- uses deterministic top-N selection,
- preserves backward compatibility,
- and requires no DB schema changes.

## Test matrix

### 1) Unit tests — ranking helper
Cover the shared pure ranking helper with cases for:
- strict N cutoff,
- points descending order,
- category-coefficient tie-break,
- players-count tie-break,
- stable deterministic fallback when all ranking inputs tie,
- total sum,
- counted sum,
- counted flag generation.

### 2) API integration tests
Cover read-side and accrual-facing behavior:
- `GET /players` returns legacy total `seasonPoints` plus additive `countedSeasonPoints` for a selected season.
- player results endpoint returns legacy per-row `seasonPoints` plus additive `isCountedInSeason`.
- legacy fields still exist and remain usable.
- overwrite accrual still runs successfully.

### 3) UI tests — player page
Verify:
- single season filter remains,
- counted competitions render before the divider,
- non-counted competitions render after the divider,
- points remain visible for every row.

### 4) UI tests — players list
Verify:
- single season filter remains,
- `Сумма очков` is visible,
- `Очки в зачете` is visible,
- values match the backend-provided totals.

### 5) Regression tests
Verify:
- no DB schema references are introduced,
- backward-compatible API fields still resolve,
- manual overwrite refresh flow remains functional.

## Detailed cases

### Unit cases
1. Fewer than N competitions: all are counted.
2. Exactly N competitions: all are counted.
3. More than N competitions: only N are counted.
4. Equal points at cutoff: higher category wins.
5. Equal points and category at cutoff: higher players count wins.
6. Sum of all points differs from counted sum.

### API cases
1. Players list for a season exposes legacy total `seasonPoints` and additive `countedSeasonPoints`.
2. Player results for a season expose additive counted flags for each competition.
3. Existing legacy fields remain present and keep their prior meaning.
4. Category ordering uses tournament-category coefficient as the tie-break source.
5. Accrual with overwrite succeeds and writes the refreshed season standings.

### UI cases
1. Player page uses one season filter only.
2. Player page renders counted rows before non-counted rows.
3. Player page inserts a visible divider only when both counted and non-counted rows exist.
4. Players list shows two point columns.
5. The season filter does not mix seasons.

## Manual verification checklist
1. Run season accrual with overwrite for a known season.
2. Open the players list and confirm total vs counted columns.
3. Open a player page and confirm counted rows appear above the divider.
4. Confirm the selection boundary obeys points → category → players count.

## Pass/fail criteria
- **Pass**: all unit, API, and UI expectations above are satisfied, backend remains the single owner of ranking truth, and overwrite rerun remains functional.
- **Fail**: any schema change, compatibility break, or mismatch between count rules and UI/API behavior.
