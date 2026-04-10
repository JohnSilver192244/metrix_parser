# Ralph Context Snapshot

- task statement: Execute Ralph workflow for missing `omx/plans/prd-settings-unified-sequence.md` by implementing recovered UI requirements from prior deep-interview traces.
- desired outcome: Unified sequential settings/update UI in web app, no API/algorithm changes, launch blocked without valid date range, date range width capped to 2 weeks, left menu fixed/sticky, copy uses exact `всего строк` where requested.
- known facts/evidence:
  - Requested PRD file is missing from `omx/plans` and `.omx/plans`.
  - Prior turn log contains recovered requirements snippets in Russian (unified sequential settings, blocked launch without range, 2-week datepicker cap, fixed left menu, exact wording for total rows).
  - Existing implementation located in `apps/web/src/features/admin-updates/*` and styles in `apps/web/src/styles/global.css`.
- constraints:
  - UI-only changes; do not change API contracts or domain algorithms.
  - Preserve existing auth and protected operation behavior.
  - Keep diffs small and covered by tests.
- unknowns/open questions:
  - Original deleted PRD acceptance criteria may include additional copy/layout details.
- likely codebase touchpoints:
  - `apps/web/src/features/admin-updates/admin-updates-page.tsx`
  - `apps/web/src/features/admin-updates/update-period-picker.tsx`
  - `apps/web/src/features/admin-updates/*.test.tsx`
  - `apps/web/src/styles/global.css`
  - `apps/web/src/features/players/player-page.tsx`
