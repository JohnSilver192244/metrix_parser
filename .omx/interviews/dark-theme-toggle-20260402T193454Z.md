# Deep Interview Transcript — Dark theme and theme switcher

## Metadata
- Profile: standard
- Rounds: 5
- Final ambiguity: 0.15
- Threshold: 0.20
- Context type: brownfield
- Context snapshot: `.omx/context/dark-theme-toggle-20260402T190456Z.md`

## Clarity Breakdown
| Dimension | Score |
|---|---:|
| Intent | 0.86 |
| Outcome | 0.90 |
| Scope | 0.92 |
| Constraints | 0.90 |
| Success | 0.84 |
| Context | 0.85 |

## Round Summary
### Round 1
User request: “Сделать темную тему и переключатель тем.”

### Round 2
Clarified non-goals: manual switching only; no persistence between sessions or reloads.

### Round 3
Clarified scope boundary: apply the theme to the whole web app.

### Round 4
Pressure pass: confirmed that the change should stay limited to colors, contrast, and states; no layout changes.

### Round 5
Clarified design system preference: use Material 3 as the palette / guidance source.

## Intent
Modernize the web app UI by adding a dark theme option and a manual theme switcher, improving visual comfort while preserving existing layout and behavior.

## Desired Outcome
- The entire web app supports light and dark themes.
- A theme switcher is visible in the top-right corner.
- The default theme on each fresh load is light.
- The user can switch themes manually during the current session.
- The selected theme does not persist across reloads or sessions.

## In-Scope
- Add theme state for light/dark mode in the web app.
- Add a top-right theme switcher control.
- Apply dark theme colors across the whole app.
- Update color, contrast, and state styling to work in both themes.
- Use Material 3 as the visual/color guidance source.

## Out-of-Scope / Non-goals
- No theme persistence in localStorage, cookies, server state, or URL params.
- No layout redesign.
- No component structure rewrite beyond what is needed for the toggle/theme wiring.
- No theme scoping to only part of the app; the whole web app should be themed.

## Decision Boundaries
OMX may decide without confirmation:
- exact implementation pattern for theme state management
- whether the toggle is a button, icon button, or switch
- exact class name / token structure for theme styles
- how theme state is propagated through the React tree

OMX may not decide without confirmation:
- changing layout or rearranging screens
- introducing persistence for theme choice
- applying theme changes to non-web targets

## Constraints
- Existing layout must remain intact.
- Only colors, contrast, and visual states may change.
- Default theme must remain light.
- Theme choice must reset on refresh/new session.
- Palette should follow Material 3 guidance.

## Testable Acceptance Criteria
1. The app renders in light theme by default on every fresh load.
2. The user can manually toggle between light and dark themes.
3. The toggle appears in the top-right corner of the web app.
4. The dark theme is applied to the entire web app, not just selected screens.
5. No layout changes are introduced as part of the theme work.
6. Theme selection does not persist after a page refresh or a new session.
7. Colors, contrast, and states remain readable in both themes.
8. Theme colors are aligned with Material 3 guidance.

## Assumptions Exposed + Resolutions
- Assumption: the toggle should remember the user’s choice.
  - Resolution: rejected; no persistence required.
- Assumption: the theme only needs to cover some screens.
  - Resolution: rejected; the entire web app should be themed.
- Assumption: layout can be adjusted to fit dark mode.
  - Resolution: rejected; only colors, contrast, and states may change.
- Assumption: theme defaults should follow system preference.
  - Resolution: rejected; default should always be light.

## Pressure-pass Findings
The earlier scope answer was revisited and tightened: the change must remain visual-only, limited to colors/contrast/states, with no layout changes.

## Brownfield Evidence vs Inference Notes
### Evidence
- `apps/web` is a React/Vite app.
- `apps/web/src/styles/global.css` currently contains `color-scheme: light;`.
- The user explicitly wants the toggle in the top-right corner.
- The user explicitly wants the theme applied to the entire web app.

### Inference
- Theme wiring will likely touch global CSS and at least one top-level web layout/component.
- The cleanest implementation is likely to use shared theme tokens or CSS variables instead of ad hoc per-component overrides.

## Technical Context Findings
Likely touchpoints:
- `apps/web/src/styles/global.css`
- top-level app layout / shell components in `apps/web/src/**`
- shared components that need theme-aware colors/states

## Condensed Transcript
- User: wants dark theme and theme switcher.
- Clarified: manual-only switching, no persistence.
- Clarified: whole app should be themed.
- Clarified: toggle should be in the top-right.
- Clarified: default theme is light.
- Pressure pass: keep changes limited to colors/contrast/states.
- Clarified: use Material 3 as the color/guidance base.

## Handoff Options
- Recommended next step: `$ralplan .omx/specs/deep-interview-dark-theme-toggle.md`
- Alternative: `$autopilot .omx/specs/deep-interview-dark-theme-toggle.md`
- Alternative: `$ralph .omx/specs/deep-interview-dark-theme-toggle.md`
- Alternative: `$team .omx/specs/deep-interview-dark-theme-toggle.md`
