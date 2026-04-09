# PRD — Dark theme and theme switcher

## Problem statement
The web app currently has a single light-only presentation. The user wants a manual dark theme toggle for the entire app, with no persistence across reloads or sessions, and with colors chosen according to Material 3 guidance. The implementation must stay visual-only: no layout changes, no broader behavioral changes.

## Requirements summary
- Apply theme changes to the entire web app.
- Add a manual theme switcher in the top-right corner.
- Default to light theme on every fresh load.
- Do not persist the selected theme across sessions or reloads.
- Keep the existing layout intact.
- Limit the change to colors, contrast, and component states.
- Use Material 3 as the palette / guidance source.

## Acceptance criteria
1. The web app renders in light theme by default.
2. A manual theme switcher is visible in the top-right corner of the app shell.
3. The user can switch between light and dark themes without a reload.
4. The chosen theme resets to light on refresh / new session.
5. The entire web app follows the selected theme, not just a subset of pages.
6. No layout changes are introduced.
7. Only colors, contrast, and interactive states change.
8. Theme colors remain readable and consistent with Material 3 guidance.
9. The theme switcher is keyboard accessible and has a clear accessible label/focus state.

## RALPLAN-DR summary
### Principles
1. Preserve layout and behavior; only theme visuals change.
2. Keep the solution manual-only and stateless.
3. Prefer a small surface area over a broad abstraction.
4. Use semantic tokens / variables so the theme applies consistently.
5. Verify both default and toggled states.

### Decision drivers
1. Lowest-risk path for a small UI-only feature.
2. Existing app shell already has a top-right action area near auth controls.
3. `global.css` already centralizes the visual layer, making a token-based theme feasible.

### Viable options
#### Option A: Local app-shell theme state + `data-theme` on the shell root (recommended)
**Approach:** Keep theme state in the app shell, pass a toggle into the top-right action area, and apply a `data-theme` attribute at the shell root so CSS variables can switch palettes.

**Pros:**
- Smallest implementation surface.
- No persistence logic to maintain.
- Easy to test with existing React/server-render tests.
- Fits the current app shell structure.

**Cons:**
- App shell props become slightly broader.
- Theme semantics live partly in React and partly in CSS.

#### Option B: Shared theme provider/context with root attribute wiring
**Approach:** Introduce a theme context/provider and expose theme state to any component that needs it, then set the root theme attribute from that provider.

**Pros:**
- Scales better if more theme-aware UI appears later.
- Cleaner separation if multiple components need theme access.

**Cons:**
- More abstraction than this feature currently needs.
- More files and indirection for a small task.

## Recommended implementation steps
1. Add a small theme state source and toggle control.
   - Likely touchpoints: `apps/web/src/app/App.tsx:63-201`, a new small theme control component under `apps/web/src/features/theme/` or a co-located helper if that fits the shell better.
   - Default to light; toggle manually only; no storage APIs.
2. Place the control in the top-right action row.
   - Likely touchpoints: `apps/web/src/app/App.tsx:73-105`, `apps/web/src/features/auth/topbar-auth-controls.tsx:5-169`, plus topbar CSS in `apps/web/src/styles/global.css:51-231`.
   - Keep the existing auth controls intact and add the theme switch beside them.
3. Convert the app palette to semantic tokens and add dark-mode overrides.
   - Likely touchpoints: `apps/web/src/styles/global.css:1-260` and the rest of the file.
   - Replace hard-coded light-only values with light defaults plus dark overrides keyed by a theme attribute/class.
   - Keep layout measurements unchanged.
4. Update the shell and any theme-sensitive surfaces to consume the new tokens.
   - Likely touchpoints: `apps/web/src/styles/global.css`, plus any page shells that still use hard-coded colors.
   - Preserve current spacing, structure, and navigation behavior.
5. Add and update tests for default theme, toggle behavior, and no-persistence expectations.
   - Likely touchpoints: `apps/web/src/app/App.test.tsx:1-151`, new or updated theme tests if the control is split out.
6. Run web checks and a manual browser smoke pass.
   - Keep verification scoped to the web app; no backend/db changes are expected.

## Risks and mitigations
- **Risk:** Dark-mode colors are incomplete because of hard-coded palette values in CSS.
  - **Mitigation:** Sweep `global.css` for hard-coded colors and replace them with semantic tokens before polishing individual elements.
- **Risk:** The top-right area becomes cramped once the toggle is added.
  - **Mitigation:** Keep the toggle compact and use the existing flex layout in the top bar.
- **Risk:** Contrast regressions make text or controls unreadable in dark mode.
  - **Mitigation:** Use Material 3-inspired colors with explicit hover/active/focus states and verify the rendered result.
- **Risk:** Persistence sneaks in via browser storage or URL state.
  - **Mitigation:** Keep theme state in memory only; do not introduce storage reads/writes.
- **Risk:** The new control is not discoverable or keyboard accessible.
  - **Mitigation:** Use a clearly labeled button/switch in the top-right action row with explicit accessible text and visible focus styling.

## Verification steps
- `npm run test --workspace @metrix-parser/web`
- `npm run check --workspace @metrix-parser/web`
- Manual smoke test in the browser:
  - default load is light,
  - toggle appears top-right,
  - toggle switches the whole app to dark,
  - refresh returns to light,
  - no layout shift occurs.

## ADR
### Decision
Implement a small in-memory theme state in the web app shell, expose a top-right toggle, and drive visual changes via semantic CSS tokens with dark overrides.

### Drivers
- Minimal scope for a UI-only change.
- No persistence requirement.
- Existing app shell and `global.css` already centralize most of the visual layer.

### Alternatives considered
- **Theme provider/context:** rejected for now because it adds abstraction that the feature does not need yet.
- **Persistence via localStorage:** rejected because the user explicitly does not want theme memory across reloads or sessions.
- **System-theme sync:** rejected because the requirement is manual switching only.

### Why chosen
This approach keeps the implementation small, testable, and aligned with the current app structure while satisfying the no-persistence constraint.

### Consequences
- The theme feature is simple to understand and test.
- Theme state remains ephemeral by design.
- If more theme-aware components appear later, a provider can still be introduced as a follow-up.

### Follow-ups
- If the app later needs preference persistence or OS sync, revisit the theme architecture.
- If more surfaces become theme-aware, consider extracting a shared provider after this feature lands.

## Available agent types roster
- `executor` — implement the theme toggle and CSS updates.
- `verifier` — validate behavior and evidence.
- `code-simplifier` — optional follow-up cleanup if the first pass becomes messy.
- `style-reviewer` — optional small-scope CSS and naming review.

## Follow-up staffing guidance
### Ralph path
Recommended lane for this feature: sequential execution with one owner.
- 1 `executor` for implementation.
- 1 `verifier` for final proof.
- Suggested reasoning: `executor=high`, `verifier=high`.
- Why: the work is small, localized, and benefits from a single cohesive implementation pass.

### Team path
Use only if the implementation fans out across multiple UI surfaces or if you want parallel implementation + verification.
- 1 `executor` for app-shell/theme wiring.
- 1 `executor` or `style-reviewer` for CSS token/palette refactoring.
- 1 `verifier` for acceptance checks.
- Suggested reasoning: `executor=high`, `style-reviewer=low`, `verifier=high`.
- Why: parallelism only helps if the CSS and component surfaces become independent enough to avoid conflicts.

## Launch hints
- Ralph: `$ralph .omx/plans/prd-dark-theme-toggle.md`
- Team: `$team .omx/plans/prd-dark-theme-toggle.md`

## Team verification path
- Team proves: toggle appears in the top-right, dark mode applies app-wide, no persistence exists, default is light, and layout remains stable.
- Ralph verifies after handoff: default state, toggle behavior, no-persistence behavior, and visual regressions against the acceptance criteria.
