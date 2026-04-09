# PRD — Competition comment for downstream blocking reasons

## Problem statement
The competitions table and competition detail view need a visible `comment` field that explains why a competition, already stored in `competitions`, could not proceed through later processing steps. The field must remain user-facing, capped at 2000 characters, and must store only the first blocking reason encountered. If the blocker originates in a child `round` / `pool` / similar descendant, the comment must still be written on the parent competition row that the user sees in the competitions table and detail view.

## Requirements summary
- Add a `comment` field to competitions with a 2000 character limit.
- The field is for list-visible and detail-visible competitions only.
- The field stores only the first blocking downstream reason.
- Child entity failures must bubble up to the parent competition comment.
- The comment lifecycle is recomputed by one canonical competition-comment reconciliation pass that inspects the current downstream state in priority order; a successful rerun clears the comment for that competition.
- Do not use the field for import-stage skips that prevent the competition from entering `competitions`.
- Cover downstream actions only:
  - fetch results,
  - save results,
  - assign category,
  - accrue season points.
- Treat category as two distinct source classes:
  - manual category update failure from the authenticated category-edit route,
  - automated category resolution failure during downstream scoring / accrual.
- The stored text should be a concise user-facing Russian explanation.
- The canonical blocker order is: fetch results > save results > manual category update > automated category resolution > season points.

## Acceptance criteria
1. A competition row in the table can display a non-empty `comment` value.
2. The competition detail view shows the same `comment` value for the visible competition.
3. If the first downstream blocker happens while fetching results, the competition row receives the corresponding comment.
4. If the first downstream blocker happens while saving results, the competition row receives the corresponding comment.
5. If the first downstream blocker happens during manual category update, the competition row receives the corresponding comment.
6. If the first downstream blocker happens during automated category resolution, the competition row receives the corresponding comment.
7. If the first downstream blocker happens while accruing season points, the competition row receives the corresponding comment.
8. If a blocker occurs in a child `round` / `pool`, the parent competition row receives the comment.
9. Only the first blocking reason is stored, even if later steps also fail.
10. The `comment` field never exceeds 2000 characters.
11. A successful rerun clears the comment when the downstream blocker is no longer present.
12. Import-stage skips that prevent insertion into `competitions` do not write to `comment`.
13. When multiple blockers coexist, the canonical blocker order decides which reason wins.

## RALPLAN-DR summary
### Principles
1. Bind the comment to the user-visible competition row, not to internal descendants.
2. Preserve a single-source-of-truth explanation per competition.
3. Keep the field human-readable and bounded.
4. Prefer bubbling child failures to the parent competition rather than duplicating child state.
5. Keep implementation local to existing competition, result, and season-standings flows.

### Decision drivers
1. The user explicitly wants the comment on the visible competition, including failures caused by descendant rounds/pools.
2. The repository already has separate downstream phases for results, category, and season accrual.
3. The field is meant to explain one blocker, not act as an audit log.

### Viable options
#### Option A: Persist a single comment on the parent competition row from the first downstream blocker (recommended)
**Approach:** When any downstream step fails for a visible competition, compute one user-facing reason and store it on the parent competition row. On the next authoritative successful downstream pass, clear the comment. Do not append later failures.

**Pros:**
- Matches the clarified intent exactly.
- Keeps the field short and comprehensible.
- Prevents noisy accumulated diagnostics.
- Easy to display in list and detail views.

**Cons:**
- Loses later failure context by design.
- Requires explicit bubbling from child entities to the parent competition.

#### Option B: Store structured multi-reason diagnostics in the competition row
**Approach:** Persist an array or serialized log of all downstream blockers on the competition row.

**Pros:**
- Captures more detail.
- Avoids losing later failures.

**Cons:**
- Conflicts with the clarified requirement to store only the first blocker.
- Harder to surface cleanly in table and detail UI.
- More schema/UI complexity than the feature needs.

#### Option C: Keep reasons only in per-step diagnostics, no competition comment
**Approach:** Leave the competition row untouched and rely on step-specific logs or update diagnostics.

**Pros:**
- No schema change on `competitions`.
- Lower write-path risk.

**Cons:**
- Does not satisfy the user-visible requirement.
- Makes the failure reason harder to find in the table/detail view.

## Recommended implementation steps
1. Add `comment` to the shared competition type and database mapping.
   - Likely touchpoints: `packages/shared-types/src/domain/competition.ts:1-53`.
   - Update `Competition` and `CompetitionDbRecord` so the API can carry the field end to end.
2. Add a migration for `app_public.competitions.comment` and make the API read/write it.
   - Likely touchpoints: `supabase/migrations/*`, `apps/api/src/modules/competitions/index.ts:19-85`, `apps/api/src/modules/competitions/index.ts:206-260`.
   - Ensure the competitions table and detail view receive the comment in the visible competition payload.
3. Add a dedicated comment-write surface for backend pipelines.
   - Likely touchpoints: a new repository/helper in `apps/worker/src/persistence/**` or a dedicated API-side write helper if the chosen ownership model needs it.
   - Keep write authority server-side/admin-only.
4. Define the blocking-reason mapping and owner-resolution helper for visible competitions.
   - Likely touchpoints: `packages/shared-types/src/domain/competition-hierarchy.ts:1-104`, `apps/worker/src/mapping/competitions.ts:206-356`, `apps/worker/src/mapping/competition-results.ts:55-149`, `apps/worker/src/persistence/competition-results-repository.ts:98-311`, `apps/api/src/modules/season-standings/index.ts:302-633`.
   - Encode the first-blocker rule, the parent-competition bubbling rule, and the success-clears-comment lifecycle.
   - Use one canonical reconciliation helper to decide which downstream blocker is first for the visible competition.
5. Thread comment assignment into the downstream pipelines.
   - Likely touchpoints: `apps/worker/src/jobs/competitions-update-job.ts:30-76`, `apps/worker/src/jobs/results-update-job.ts:130-223`, `apps/worker/src/jobs/results-pipeline-update-job.ts:143-224`, `apps/api/src/modules/season-standings/index.ts:499-633`.
   - For each competition, compute the first blocking reason and persist it on the visible competition row.
6. Add UI coverage so the competitions table and competition-results detail view render the comment consistently.
   - Likely touchpoints: `apps/web/src/features/competitions/competitions-page.tsx:865-961`, `apps/web/src/features/results/competition-results-page.tsx:135-220`, `apps/web/src/features/results/competition-results-page.tsx:561-688`, plus the shared API contract in `packages/shared-types`.
   - Keep display text unchanged across list and detail views.
7. Add targeted tests for parent bubbling, first-blocker selection, the pool-size descendant case, manual-vs-automated category failures, clearing on success, and 2000-character bounds.
   - Verify a child `pool` / `round` failure writes to the parent competition row.
   - Verify only the first failure is stored.
   - Verify the “all child pools have fewer than 8 players” case maps to the visible parent competition comment.
   - Verify manual category update failure and automated category resolution failure are mapped as distinct reason families.
   - Verify successful rerun clears the comment.
   - Verify comment length enforcement.
8. Run the relevant API, worker, and web test suites and fix any regressions.

## Risks and mitigations
- **Risk:** The comment gets written on the wrong entity, especially child rows.
  - **Mitigation:** Resolve the competition owner using the existing hierarchy helpers and test parent bubbling explicitly.
- **Risk:** Later failures overwrite the first blocking reason.
  - **Mitigation:** Persist once per competition using a first-wins rule and guard against repeated writes.
- **Risk:** The field becomes a generic error log.
  - **Mitigation:** Keep the schema and UI string single-valued and capped at 2000 characters.
- **Risk:** The UI shows a comment on the list but not the detail view, or vice versa.
  - **Mitigation:** Treat the visible competition payload as the source of truth for both views.
- **Risk:** The planned text becomes too technical for users.
  - **Mitigation:** Map internal failure states to concise Russian user-facing phrases.
- **Risk:** Comments become stale after the underlying blocker is fixed.
  - **Mitigation:** Recompute from the latest authoritative downstream pass and clear the field on success.
- **Risk:** The wrong competition row gets updated when the blocker happens in a descendant round/pool.
  - **Mitigation:** Use a shared owner-resolution helper and test the parent-bubbling path explicitly.
- **Risk:** Manual category save failures and automated category-resolution failures get mixed together.
  - **Mitigation:** Treat them as distinct reason families even if they land in the same comment field.

## Verification steps
- Add or update unit and integration tests in:
  - `apps/worker/src/mapping/competitions.test.ts`
  - `apps/worker/src/mapping/competition-results.test.ts`
  - `apps/worker/src/persistence/competition-results-repository.test.ts`
  - `apps/api/src/app.test.ts`
  - `apps/web/src/features/competitions/competitions-page.test.tsx`
  - `apps/web/src/features/results/competition-results-page.test.tsx`
- Run the concrete workspace checks:
  - `npm run test --workspace @metrix-parser/api`
  - `npm run test --workspace @metrix-parser/worker`
  - `npm run test --workspace @metrix-parser/web`
  - `npm run check --workspace @metrix-parser/api`
  - `npm run check --workspace @metrix-parser/worker`
  - `npm run check --workspace @metrix-parser/web`
- Confirm the list and detail views show the same comment after the data reload path that clears stale comments.

## ADR
### Decision
Add a single user-facing `comment` field to the visible competition row and write the first downstream blocking reason there, bubbling child `round` / `pool` failures to the parent competition.

### Drivers
- The user explicitly wants the comment on the competition they can see in the table and detail view.
- Only the first blocking reason should be stored.
- The repository already separates competition import, result processing, and season accrual into distinct stages.

### Alternatives considered
- **Structured multi-reason diagnostics:** rejected because it conflicts with the one-reason requirement and adds unnecessary complexity.
- **Per-step logs only:** rejected because it does not satisfy the user-visible requirement.

### Why chosen
This design is the smallest change that matches the clarified behavior: one visible competition, one comment, one first blocker, with descendant failures bubbling up to the parent row the user sees.

### Consequences
- The field stays readable and predictable.
- Some later failure context is intentionally discarded.
- Successful reruns can clear stale comments, which keeps the UI aligned with current state.
- The implementation needs hierarchy-aware routing from child entities to the visible parent competition.

### Follow-ups
- If the team later needs richer diagnostics, add separate internal processing logs rather than expanding `comment`.
- If the field needs localization or formatting rules, define them once in the shared API contract.

## Available agent types roster
- `executor` - implement shared types, API wiring, worker logic, and any UI propagation.
- `verifier` - confirm the comment reaches list/detail outputs and the first-blocker rule holds.
- `debugger` - isolate failures in bubbling or persistence if tests expose mismatches.
- `code-simplifier` - clean up repeated reason-selection logic after the feature lands.
- `style-reviewer` - check wording and naming for the visible comment UX.

## Follow-up staffing guidance
### Ralph path
Recommended lane: sequential execution with one owner.
- 1 `executor` for schema/type/API/worker changes.
- 1 `verifier` for acceptance and regression proof.
- Suggested reasoning levels: `executor=high`, `verifier=high`.
- Why: the change spans shared types, worker logic, API payloads, and UI visibility, but the logic is still cohesive enough for a single owner.

### Team path
Use only if the implementation fans out across API, worker, and web at the same time.
- 1 `executor` for shared types and API payload wiring.
- 1 `executor` for worker-side first-blocker resolution and bubbling logic.
- 1 `executor` or `style-reviewer` for list/detail UI rendering.
- 1 `verifier` for end-to-end evidence.
- Suggested reasoning levels: `executor=high`, `style-reviewer=low`, `verifier=high`.
- Why: parallelism helps only if the data model, downstream processing, and UI can be modified with low overlap.

## Launch hints
- Ralph: `$ralph .omx/plans/prd-competition-comment.md`
- Team: `$team .omx/plans/prd-competition-comment.md`

## Team verification path
- Team proves: the visible competition receives the first blocking reason, child failures bubble to the parent competition, the field length is respected, and the table/detail view display the same comment.
- Ralph verifies after handoff: the first blocker wins, the parent row is targeted, and no child-only comment leaks into the UI.
