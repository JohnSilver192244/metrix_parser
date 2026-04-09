## Task statement
Implement PRD `.omx/plans/prd-competition-comment.md`: add and propagate a single user-facing competition `comment` for first downstream blockers, with child-to-parent bubbling and clear-on-success lifecycle.

## Desired outcome
- `comment` field available on visible competitions in shared types/API/UI.
- Downstream fetch/save/category/season failures map to one first blocker comment.
- Child round/pool failures bubble to visible parent competition.
- Successful reruns clear managed comments.
- Tests and typechecks pass for api/worker/web.

## Known facts/evidence
- Migration exists: `supabase/migrations/0020_add_comment_to_competitions.sql`.
- Shared domain includes comment normalization/priority helpers.
- API routes include manual/automated category comment handling.
- Worker had regressions in comment reconciliation owner resolution and env-coupled defaults; fixed.
- Verification completed for `npm run test/check` in `@metrix-parser/worker`, `@metrix-parser/api`, `@metrix-parser/web`.

## Constraints
- Preserve existing behavior outside competition-comment scope.
- No destructive git operations.
- Keep Russian user-facing comment messages concise and bounded.
- Respect hierarchy semantics for list-visible competitions.

## Unknowns/open questions
- No unresolved blockers in tested scope.

## Likely codebase touchpoints
- `apps/worker/src/persistence/competition-comments-repository.ts`
- `apps/worker/src/jobs/results-update-job.ts`
- `apps/worker/src/jobs/results-pipeline-update-job.ts`
- `apps/worker/src/mapping/competitions.test.ts`
- `apps/worker/src/orchestration/update-execution.ts`
