# Deep Interview Transcript — Cloudflare one-deploy migration

## Metadata
- Profile: standard
- Rounds: 6
- Final ambiguity: 0.10
- Threshold: 0.20
- Context type: brownfield
- Context snapshot: `.omx/context/deep-interview-missing-task-20260413T153206Z.md`

## Clarity Breakdown
| Dimension | Score |
|---|---:|
| Intent | 0.88 |
| Outcome | 0.93 |
| Scope | 0.92 |
| Constraints | 0.90 |
| Success | 0.85 |
| Context | 0.86 |

## Round Summary
### Round 1
User confirmed that URL and JSON contract changes are allowed if they make the stack fit Cloudflare better.

### Round 2
User confirmed that Supabase remains the database, while frontend, backend, and worker runtimes move to Cloudflare.

### Round 3
User confirmed the delivery goal is one repository, one branch, and one deploy per push.

### Round 4
User confirmed the preferred target is one Cloudflare project with internal separation between API modules and job modules.

### Round 5
User confirmed Supabase schema/table changes are allowed only if every affected endpoint is updated and verified.

### Round 6
Pressure pass: the user clarified the main objective is free Cloudflare hosting through one Cloudflare full-stack project, with business logic unchanged and only infrastructure/stack changes in scope.

## Intent
Reduce hosting cost and operational complexity by moving the product to a single Cloudflare full-stack deployment that is compatible with the free plan.

## Desired Outcome
- One repository remains the source of truth.
- One branch remains the development branch.
- One push produces one deploy.
- `apps/web` becomes a Cloudflare full-stack project.
- API routes move to Cloudflare Worker / Pages Functions style entrypoints.
- `apps/api` no longer exists as a separate deployable service.
- `apps/worker` is split into smaller background and scheduled jobs inside the same Cloudflare project.
- Supabase remains the database.
- URL and JSON contract changes are allowed if they better fit the new stack.

## In-Scope
- Cloudflare project setup for the full-stack app.
- API routing migration to Cloudflare-native handlers.
- Removal of `apps/api` as an independent runtime.
- Refactoring worker logic into smaller job modules and scheduled/background handlers.
- Deployment/config changes required to get to one Cloudflare deploy.
- Any schema/table changes needed for the migration, provided all affected endpoints are updated and verified.
- Test and verification updates across all touched routes, jobs, and data access paths.

## Out-of-Scope / Non-goals
- No change to business logic.
- No change to algorithms.
- No change to calculations.
- No change to entities or domain processes.
- No introduction of a second deploy target.
- No multi-repo split.
- No separate frontend/backend/worker infrastructure after the migration.
- No switch away from Supabase as the database.
- No schema change unless the downstream endpoints and flows are updated and verified.

## Decision Boundaries
OMX may decide without confirmation:
- exact Cloudflare project layout
- API route/file organization
- job module boundaries
- build, bundling, and deploy wiring
- internal contract shaping for the new Cloudflare runtime
- how to decompose worker work into smaller handlers

OMX may not decide without confirmation:
- any business-logic change
- any new product behavior beyond infra/runtime migration
- any second deployable service
- any move away from the one-project / one-deploy target
- any schema change that is not fully propagated and verified

## Constraints
- The solution must be suitable for Cloudflare free hosting.
- The final setup must be a single Cloudflare project.
- One push must correspond to one deploy.
- The repo should stay on one development branch.
- Supabase must remain the database.
- Infrastructure changes are allowed; domain behavior is frozen.
- If schemas or tables change, every affected endpoint must be updated and tested.

## Testable Acceptance Criteria
1. The repository has one Cloudflare deployable project for web, API, and jobs.
2. There is no separate `apps/api` deployable service after the migration.
3. Web traffic and API traffic are served from the Cloudflare project.
4. Worker tasks run as smaller background and/or scheduled jobs inside the same project.
5. The deployment pipeline produces one deploy per push.
6. Supabase continues to serve as the database.
7. Business logic and domain behavior remain unchanged.
8. Any URL or JSON contract changes are covered by updated tests.
9. Any schema or table changes are covered by updated endpoint and flow verification.
10. The final setup is compatible with Cloudflare free-hosting constraints.

## Assumptions Exposed + Resolutions
- Assumption: API paths must remain unchanged.
  - Resolution: rejected; URL and JSON contracts may change.
- Assumption: Supabase must be replaced to fit Cloudflare.
  - Resolution: rejected; Supabase remains the database.
- Assumption: multiple deploy targets are acceptable if they are in one repo.
  - Resolution: rejected; the goal is one deploy per push.
- Assumption: worker logic can stay as one monolithic runtime.
  - Resolution: rejected; it should be split into smaller internal job modules.
- Assumption: schema changes are forbidden.
  - Resolution: rejected; they are allowed if all affected endpoints are updated and verified.

## Pressure-pass Findings
The scope was revisited after the technical boundary questions and tightened to the actual product goal: free Cloudflare hosting through one full-stack project, while freezing business logic and allowing only infra/runtime changes.

## Brownfield Evidence vs Inference Notes
### Evidence
- The repo currently has three deployable app workspaces: `apps/web`, `apps/api`, and `apps/worker`.
- Root scripts expose separate dev entrypoints for web, API, and worker.
- The user explicitly wants one repo, one branch, and one deploy per push.
- The user explicitly said Supabase stays.
- The user explicitly allowed URL, JSON contract, and schema changes under verification constraints.

### Inference
- The migration will likely require new Cloudflare configuration and a new deployment surface.
- API entrypoints will likely need to be reorganized into Cloudflare-native handlers.
- Worker orchestration will likely need to be split into smaller job modules.

## Technical Context Findings
Likely touchpoints:
- root `package.json`
- `apps/web` build/dev/runtime wiring
- `apps/api` runtime removal or merge into the Cloudflare project
- `apps/worker` job decomposition
- shared API/client contract code
- Supabase access helpers and schema-aware tests
- Cloudflare-specific config files and deploy scripts

## Condensed Transcript
- User: wants a single-deploy Cloudflare full-stack migration.
- Clarified: URL and JSON contracts may change.
- Clarified: Supabase remains the database.
- Clarified: one repo, one branch, one deploy per push.
- Clarified: one Cloudflare project with internal API/job modules.
- Clarified: schema changes are allowed only with full endpoint verification.
- Pressure pass: the real goal is free Cloudflare hosting, with business logic frozen.

## Residual Risk
Low to moderate residual risk. The brief is clear enough for planning, but the exact Cloudflare project topology and migration sequence still need architecture validation.

## Handoff Recommendation
Use this as the source of truth for the next step:
- Recommended: `$ralplan .omx/specs/deep-interview-cloudflare-one-deploy.md`
- Alternative: `$autopilot .omx/specs/deep-interview-cloudflare-one-deploy.md`
- Alternative: `$ralph .omx/specs/deep-interview-cloudflare-one-deploy.md`
- Alternative: `$team .omx/specs/deep-interview-cloudflare-one-deploy.md`
