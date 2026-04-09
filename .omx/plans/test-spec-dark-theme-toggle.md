# Test Spec — Dark theme and theme switcher

## Scope of verification
Verify that the web app:
- loads in light theme by default,
- supports a manual top-right theme switcher,
- applies theme changes across the whole app,
- does not persist the chosen theme,
- and keeps layout unchanged while only colors/states change.

## Test matrix

### 1) Unit tests
Cover the theme state / toggle logic with cases for:
- default theme is light,
- toggling switches to dark,
- toggling again switches back to light,
- no storage API is called,
- no persistence helper is involved.

### 2) App shell tests
Cover the shell wiring with cases for:
- the theme toggle renders in the top-right action area,
- the toggle has an accessible label and remains keyboard operable,
- the shell exposes the selected theme to the root container,
- the auth controls continue to render unchanged,
- the navigation and route handling still work.

### 3) CSS / visual contract checks
Cover the token layer with cases for:
- light palette values remain the default,
- dark overrides are present and scoped correctly,
- topbar, content panels, buttons, and link states remain readable,
- no layout properties are changed as part of theming.

### 4) Manual browser verification
Cover the user-visible behavior with cases for:
- initial load is light,
- theme switcher is visible top-right,
- manual click switches to dark,
- page refresh returns to light,
- no layout shift or content jump occurs.

## Detailed cases

### Unit cases
1. Default theme is light when the app shell mounts.
2. Toggle action changes the theme state to dark.
3. Toggle action changes the theme state back to light.
4. No localStorage/sessionStorage read or write occurs.
5. Theme state is not derived from URL or cookies.

### App shell cases
1. `AppShellView` still renders the title, nav, and auth controls.
2. Theme toggle appears in the same top-row area as the other top-right actions.
3. Theme selection updates the shell root attribute/class used by CSS.
4. The top bar still behaves as sticky navigation.
5. The toggle exposes an accessible name and can be activated with keyboard interaction.

### CSS contract cases
1. Light defaults continue to come from the base theme tokens.
2. Dark overrides change background, text, border, accent, and panel states.
3. Focus / hover / active states remain visible in both themes.
4. The layout metrics, spacing, and flex/grid behavior remain unchanged.

### Manual smoke checklist
1. Open the app in a clean browser session.
2. Confirm the theme is light.
3. Use the top-right toggle to switch to dark.
4. Confirm the entire app changes theme.
5. Refresh the page and confirm the theme resets to light.
6. Confirm the page layout is unchanged.
7. Confirm the toggle is keyboard reachable and has a readable label.

## Pass/fail criteria
- **Pass**: the toggle is manual-only, default remains light, no persistence exists, the full app themes correctly, and layout stays intact.
- **Fail**: any persistence is introduced, only part of the app themes, or layout changes beyond visual colors/states are observed.
