# Deep Interview Spec — Cloudflare one-deploy migration

## Metadata
- Profile: standard
- Rounds: 6
- Final ambiguity: 0.10
- Threshold: 0.20
- Context type: brownfield
- Context snapshot: `.omx/context/deep-interview-missing-task-20260413T153206Z.md`
- Transcript: `.omx/interviews/cloudflare-one-deploy-20260413T154505Z.md`

## Clarity Breakdown
| Dimension | Score |
|---|---:|
| Intent | 0.88 |
| Outcome | 0.93 |
| Scope | 0.92 |
| Constraints | 0.90 |
| Success | 0.85 |
| Context | 0.86 |

## Intent
Move the product to a single Cloudflare full-stack deployment so it can be hosted on Cloudflare free plan infrastructure, while keeping business logic unchanged.

## Desired Outcome
- One repository remains the source of truth.
- One branch remains the development branch.
- One push produces one deploy.
- The app is hosted as one Cloudflare project.
- `apps/web` is migrated into the Cloudflare full-stack project.
- API routes run as Worker/Pages Functions style handlers inside that project.
- `apps/api` is removed as a separate service.
- `apps/worker` is broken into smaller background and scheduled jobs inside the same project.
- Supabase remains the database.
- URL, JSON, and schema changes are allowed when needed for the migration.

## In-Scope
- Cloudflare project setup and deployment wiring.
- Web app migration to Cloudflare full-stack runtime.
- API route migration to Cloudflare-native handlers.
- Worker job decomposition into smaller internal modules.
- Removal of `apps/api` as an independent service.
- Any schema/table changes required to support the new runtime, with full endpoint and flow verification.
- Test updates that prove every affected endpoint, job, and data flow still works.

## Out-of-Scope / Non-goals
- No business-logic changes.
- No algorithm changes.
- No calculation changes.
- No entity or process redesign.
- No second deploy target.
- No extra repo split.
- No separate runtime for frontend, backend, and worker after migration.
- No database-provider migration away from Supabase.
- No unverified schema change.

## Decision Boundaries
OMX may decide without confirmation:
- Cloudflare project layout
- route structure and file organization
- internal module boundaries
- worker/job decomposition strategy
- build and deploy tool wiring
- contract reshaping for URLs and JSON payloads

OMX may not decide without confirmation:
- any change to business logic
- any additional product behavior beyond infra/runtime migration
- any second deployable service
- any deviation from the one-project / one-deploy target
- any schema change not accompanied by full endpoint and flow verification

## Constraints
- The migration must be compatible with Cloudflare free hosting.
- The final architecture must be a single Cloudflare project.
- One push must map to one deploy.
- Supabase stays the database.
- The repo stays on one development branch.
- Only infrastructure/runtime changes are allowed unless schema changes are necessary and fully verified.

## Testable Acceptance Criteria
1. The product deploys as one Cloudflare project.
2. There is only one deploy path per push.
3. The frontend is served from that Cloudflare project.
4. API routes are handled inside that same Cloudflare project.
5. Background/scheduled worker tasks run inside that same project as smaller job modules.
6. `apps/api` no longer exists as a separate runtime.
7. Supabase remains the data layer.
8. Business logic, algorithms, calculations, and domain processes are unchanged.
9. Any URL or JSON contract changes are covered by updated tests.
10. Any schema or table changes are covered by updated endpoint, job, and flow verification.
11. The final setup is suitable for Cloudflare free-plan hosting.

## Assumptions Exposed + Resolutions
- Assumption: contract stability matters more than Cloudflare fit.
  - Resolution: rejected; contract changes are allowed if they improve the fit.
- Assumption: Supabase must be replaced.
  - Resolution: rejected; Supabase remains.
- Assumption: multiple deployables in one repo are acceptable.
  - Resolution: rejected; the goal is one deploy per push.
- Assumption: worker logic should stay monolithic.
  - Resolution: rejected; split it into smaller internal jobs.
- Assumption: schema changes are off-limits.
  - Resolution: rejected; they are allowed with full verification.

## Pressure-pass Findings
The interview revisited the boundary between infrastructure change and product change and confirmed that only the infrastructure/stack should move. The free-hosting goal on Cloudflare is the primary driver.

## Brownfield Evidence vs Inference Notes
### Evidence
- The repo currently exposes separate web, API, and worker app workspaces.
- Separate workspace scripts show the current system is split across multiple runtimes.
- The user explicitly stated the goal is one repo, one branch, and one deploy per push.
- The user explicitly stated Supabase remains the database.

### Inference
- The Cloudflare migration will likely require a new project layout and deploy config.
- Existing API and worker code will likely need to be reorganized to fit Cloudflare-native handlers.
- Test coverage will need to prove contract and schema changes across all affected entrypoints.

## Technical Context Findings
Likely touchpoints:
- root `package.json`
- `apps/web`
- `apps/api`
- `apps/worker`
- shared API/client contract code
- Supabase access helpers and schema-related tests
- Cloudflare config and deployment scripts

## Residual Risk
Low to moderate residual risk. Requirements are clear, but the implementation plan still needs architecture validation and migration sequencing.

## Handoff Recommendation
Use this as the source of truth for the next step:
- Recommended: `$ralplan .omx/specs/deep-interview-cloudflare-one-deploy.md`
- Alternative: `$autopilot .omx/specs/deep-interview-cloudflare-one-deploy.md`
- Alternative: `$ralph .omx/specs/deep-interview-cloudflare-one-deploy.md`
- Alternative: `$team .omx/specs/deep-interview-cloudflare-one-deploy.md`
