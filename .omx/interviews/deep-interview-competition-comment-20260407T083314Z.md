# Deep Interview Transcript Summary

## Context
- Task: add a `comment` field for competitions, up to 2000 characters.
- Scope: only competitions that already exist in `competitions`, and only downstream actions after the competition is already stored.
- Comment behavior: store only the first blocking reason, not a concatenated list.

## Confirmed intent
- The comment should explain why a downstream action could not be applied to an existing competition row.
- The comment is user-facing text, not an internal diagnostics log.

## Clarified boundaries
- Do not use the field for import-stage skips that prevent the competition from being inserted at all.
- Do not append multiple reasons from later stages.
- Use the first blocking reason in execution order.
- The comment belongs to the competition that is visible in the competitions table and in competition detail view.
- If a downstream blocker happens in a child entity such as a round or pool, the reason must be recorded on the parent competition that the user sees.

## Pressure-pass outcome
- Earlier ambiguity: whether the comment should collect one reason or multiple reasons.
- Resolution: one reason only, the first blocker.

## Evidence from codebase
- Competition import already has validation/filtering reasons in `apps/worker/src/mapping/competitions.ts`.
- Results import/persistence has separate validation reasons in `apps/worker/src/mapping/competition-results.ts` and `apps/worker/src/persistence/competition-results-repository.ts`.
- Season points accrual has explicit logical skip points in `apps/api/src/modules/season-standings/index.ts`.

## Proposed downstream stages to cover
1. Fetch competition results.
2. Save competition results.
3. Assign or resolve competition category.
4. Accrue season points.

## User-facing exclusion reasons to consider
### Fetch results
- No source identifier for results.
- DiscGolfMetrix fetch failed.
- Remote payload unavailable or malformed.

### Save results
- Result row is missing `competitionId`.
- Result row is missing `playerId`.
- Result row is missing `orderNumber`.
- Result row is missing `sum` or `diff` for a non-DNF result.
- Result row already exists and overwrite is disabled.

### Assign category
- Category cannot be inferred from the competition or its parent chain.
- Category is absent or blank on the competition and ancestors.
- Category lookup/update failed.

### Accrue season points
- Competition is not a scoring unit candidate.
- Inherited category is missing.
- Category coefficient is missing.
- Competition has too few eligible participants for the season.
- Season points matrix has no matching row for the computed `players_count` and placement.
- Existing season standings already exist and overwrite is disabled.

## Open decision
- Use the first blocking reason only, in priority order:
  1. fetch results
  2. save results
  3. assign category
  4. accrue season points
- When the blocker is in a child round/pool path, attach the first blocking reason to the parent competition row, not the child row.
