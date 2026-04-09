# Test Spec — Competition comment for downstream blocking reasons

## Scope of verification
Verify that a competition already present in `competitions` can carry a single visible `comment` that explains the first downstream blocker, including blockers originating from child `round` / `pool` entities, and that the same comment is visible in both the competitions table and competition detail view.

## Test matrix

### 1) Shared model and API contract tests
Cover the competition payload with cases for:
- `comment` is present on the shared competition type,
- `comment` is persisted through the DB mapping,
- `comment` is limited to 2000 characters,
- the field is part of the visible competition payload, not a child-only payload.
- a successful rerun clears the stored `comment`.

### 2) First-blocker selection tests
Cover the reason selection with cases for:
- the first downstream failure is used,
- later downstream failures do not overwrite the first reason,
- the stored text is the first blocker in execution order,
- the selected reason is user-facing, not an internal issue code.
- when two blockers coexist, the canonical blocker order picks the higher-priority one.

### 3) Parent bubbling tests
Cover hierarchy behavior with cases for:
- a child `round` failure writes to the parent competition comment,
- a child `pool` failure writes to the parent competition comment,
- a parent `Event (4)` row is used as the visible target when descendants block processing,
- the child row itself is not the comment target.
- the “all child pools have fewer than 8 players” case writes the comment to the visible parent competition row.

### 4) Downstream action coverage tests
Cover the downstream action families with cases for:
- fetch results failure produces a competition comment,
- save results failure produces a competition comment,
- manual category update failure produces a competition comment,
- automated category-resolution failure produces a competition comment,
- season points accrual failure produces a competition comment.
- a later successful run clears the earlier comment for the same competition.
- a successful manual category update clears a prior manual-category comment.
- a full downstream reconciliation clears stale comments from earlier fetch/save/season-points failures.

### 5) UI visibility tests
Cover the competitions UI with cases for:
- the table shows the comment for the visible competition,
- the detail view shows the same comment,
- the comment is absent when no downstream blocker exists,
- the UI does not show child-row comments separately.
- the table and detail view continue to show the same value after a successful rerun clears the comment.

### 6) Manual smoke checklist
Cover end-user behavior with cases for:
- open a competition that has a downstream blocker,
- see the comment in the table row,
- open the competition detail view,
- see the same comment there,
- confirm a child `round` / `pool` failure appears on the parent competition row,
- confirm the text is short, readable, and not a diagnostic dump.

## Detailed cases

### Shared contract cases
1. `Competition` includes `comment`.
2. `CompetitionDbRecord` includes `comment`.
3. `comment` can be round-tripped through the API without truncation below 2000 characters.
4. Child `round` / `pool` models do not become the primary target for comment rendering.
5. A successful rerun clears the stored `comment`.

### First-blocker cases
1. Only the first failure reason is written.
2. A later failure in the same pipeline run does not replace the earlier reason.
3. The stored value matches the first user-facing blocker text.

### Parent bubbling cases
1. A child `round` failure maps to the parent competition row.
2. A child `pool` failure maps to the parent competition row.
3. The competitions table row and detail view resolve the same visible competition identity.
4. The “all child pools have fewer than 8 players” case maps to the visible parent competition row.

### Downstream action cases
1. Fetch-results failure sets the comment.
2. Save-results failure sets the comment.
3. Manual category update failure sets the comment.
4. Automated category-resolution failure sets the comment.
5. Season-points failure sets the comment.
6. A later successful run clears the earlier comment.

### UI cases
1. Table row renders the comment when present.
2. Detail view renders the same comment when present.
3. Empty or absent comment does not create UI noise.

## Pass/fail criteria
- **Pass**: the competition row shows a single first-blocker comment, child failures bubble to the parent competition, the same value appears in table and detail, and the field stays within 2000 characters.
- **Fail**: multiple reasons are concatenated, child rows become the target, the comment appears only in one view, or the field is not present in the visible competition payload.
