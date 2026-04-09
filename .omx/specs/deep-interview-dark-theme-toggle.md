# Deep Interview Spec — Dark theme and theme switcher

## Metadata
- Profile: standard
- Rounds: 5
- Final ambiguity: 0.15
- Threshold: 0.20
- Context type: brownfield
- Context snapshot: `.omx/context/dark-theme-toggle-20260402T190456Z.md`
- Transcript: `.omx/interviews/dark-theme-toggle-20260402T190456Z.md`

## Clarity Breakdown
| Dimension | Score |
|---|---:|
| Intent | 0.86 |
| Outcome | 0.90 |
| Scope | 0.92 |
| Constraints | 0.90 |
| Success | 0.84 |
| Context | 0.85 |

## Intent
Add a dark theme and manual theme switching to the web app so the UI feels more modern and comfortable to use, while keeping the current layout and behavior intact.

## Desired Outcome
- The web app supports both light and dark themes.
- A theme switcher is visible in the top-right corner.
- The default theme is light on each fresh load.
- The user can manually switch themes in the current session.
- The selected theme is not remembered across reloads or between sessions.
- The visual palette follows Material 3 guidance.

## In-Scope
- Theme state for light/dark mode in the web app.
- Top-right theme toggle control.
- Dark-theme styling across the whole app.
- Color, contrast, and state styling updates for both themes.
- Material 3-informed palette selection.

## Out-of-Scope / Non-goals
- No persistence of theme choice.
- No layout redesign.
- No visual changes beyond colors, contrast, and states.
- No partial theme rollout; the whole web app must be themed.

## Decision Boundaries
OMX may decide without confirmation:
- theme implementation pattern
- toggle control type and iconography
- CSS variables / class structure / state wiring
- how to propagate theme state through React components

OMX may not decide without confirmation:
- changing page layout
- adding persistence
- applying this task outside the web app

## Constraints
- Default theme must always be light.
- Theme choice must reset on refresh and on new sessions.
- The change must preserve the existing layout.
- Only colors, contrast, and states may change.
- The palette should be aligned with Material 3.

## Testable Acceptance Criteria
1. The web app loads in light theme by default.
2. The user can switch to dark theme and back to light theme manually.
3. The theme switcher is placed in the top-right corner.
4. The dark theme covers the entire web app.
5. No layout changes are introduced.
6. Theme selection is not persisted across reloads or sessions.
7. Text, surfaces, borders, and interactive states remain readable in both themes.
8. Theme colors are aligned with Material 3 guidance.

## Assumptions Exposed + Resolutions
- Persistence was intentionally rejected.
- System theme sync was not requested and should not be added by default.
- Only visual tokens/states should change; layout is frozen.

## Pressure-pass Findings
The interview revisited the scope boundary and confirmed the implementation must remain visual-only: colors, contrast, and states only.

## Brownfield Evidence vs Inference Notes
### Evidence
- `apps/web` is a React/Vite web app.
- `apps/web/src/styles/global.css` currently sets `color-scheme: light;`.
- The user specified the toggle placement and default theme.

### Inference
- A top-level web shell component and global stylesheet likely need updates.
- Shared theme tokens or CSS variables are the most likely maintainable approach.

## Technical Context Findings
Likely touchpoints:
- `apps/web/src/styles/global.css`
- top-level app shell/layout components under `apps/web/src/**`
- shared UI components that need theme-aware colors and states

## Residual Risk
Low residual risk. The brief is specific enough for planning, but implementation details still need architecture/feasibility validation.

## Handoff Recommendation
Use this as the source of truth for the next step:
- Recommended: `$ralplan .omx/specs/deep-interview-dark-theme-toggle.md`
- Alternative: `$autopilot .omx/specs/deep-interview-dark-theme-toggle.md`
- Alternative: `$ralph .omx/specs/deep-interview-dark-theme-toggle.md`
- Alternative: `$team .omx/specs/deep-interview-dark-theme-toggle.md`
