# FITFORGE design system specification

This is a repository-owned, Figma-ready design source. No Figma file has been created or edited. The visual direction is a premium training log: warm paper-like surfaces, charcoal typography, a restrained vermilion action accent, and clear data visualization rather than a generic AI dashboard.

## Design tokens

| Token                 | Value     | Usage                               |
| --------------------- | --------- | ----------------------------------- |
| `color.canvas`        | `#F4F1EA` | Main page background                |
| `color.surface`       | `#FFFEFA` | Primary content surfaces            |
| `color.surface-muted` | `#EAE6DD` | Secondary backgrounds               |
| `color.ink`           | `#20211F` | Primary text and icons              |
| `color.ink-muted`     | `#666861` | Supporting text                     |
| `color.border`        | `#D7D3CA` | Dividers and control borders        |
| `color.action`        | `#C4442D` | Primary actions and selected states |
| `color.action-hover`  | `#A93624` | Hover/pressed action                |
| `color.positive`      | `#386B4A` | Completed goals and positive trends |
| `color.warning`       | `#96631F` | Caution and incomplete states       |
| `color.danger`        | `#A4312E` | Destructive actions and errors      |

Use a readable sans-serif UI face (Inter or system sans) for controls and data; reserve a restrained editorial serif for large landing-page headlines only. Typography sizes: 12, 14, 16, 20, 24, 32, and 48 px with line-height 1.2 for display and 1.5 for body. Weight range: 400–700.

Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64 px. Use 1 px borders, 4–8 px control corners, 10 px content surface corners, and minimal shadow (0 2px 8px at 8% ink). Avoid rounded-everything card layouts.

## Breakpoints and layout

- Small: 360–639 px; one-column content, compact top bar, bottom navigation for authenticated screens.
- Medium: 640–1023 px; two-column dashboard where the data remains readable.
- Large: 1024–1439 px; persistent left navigation with a 240 px rail.
- Wide: 1440 px and above; content max width 1320 px and wider chart area.

All content reflows without horizontal scrolling at 320 px. Touch targets are at least 44 by 44 px. Charts have a text/table alternative.

## Component inventory

- Navigation: public header, authenticated side rail, compact mobile tab bar, breadcrumbs.
- Actions: primary, secondary, quiet, destructive buttons; icon buttons with text alternatives.
- Inputs: labelled text/number/select controls, unit suffixes, validation help and errors.
- Data display: exercise row, workout-day list, set row, nutrition entry, stat summary, chart legend.
- Feedback: skeleton/loading, empty state with next action, inline validation, retryable error, success confirmation.
- Accessibility: visible focus ring, keyboard order, semantic headings, field labels, status announcements, reduced-motion support, 4.5:1 minimum text contrast.

## Screen specifications

1. **Landing:** compact product statement, realistic product preview, feature explanation, clear sign-in/register actions. No invented customer counts, testimonials, or promises.
2. **Dashboard:** today's workout and completion state, today's nutrition totals only when logged, recent real progress summary, next scheduled session. Missing data uses clear setup prompts rather than fabricated values.
3. **Workout plan:** goal and schedule summary, day navigation, exercise list with sets/reps/rest, edit and start actions gated by authentication.
4. **Active session:** current movement, set progression, editable load/reps, rest timer, session progress, pause/finish confirmation. Persist through the Workout API before showing completion.
5. **Exercise catalogue:** search/filter controls, movement and muscle metadata, accessible list/grid, detail drawer with instructions and media only when available.
6. **Nutrition log:** date selector, meal sections, food/serving search, measured portions, daily calories/macros from food records, explicit empty state when nutrition data is unavailable.
7. **Progress analytics:** body weight and lift charts driven by Progress API data, selectable ranges, labels/tooltips, no seeded user metrics.
8. **AI assistant:** only render after grounded AI API implementation; display citations and uncertainty, distinguish model output, and make clear it is not medical advice. Until then show an unavailable/coming-later state, not a fake chat.
9. **Profile/preferences:** account basics, training goal, activity/diet preferences, units, and privacy controls.

## Key journeys and motion

- New user: register → complete profile/preferences → browse exercises → create plan → start session.
- Returning user: dashboard → active session → record sets → finish → view updated history.
- Nutrition: search a food → confirm serving → add meal → review computed daily totals.
- Progress: select metric and date range → inspect trend and accessible table.

Motion is limited to 120–180 ms control feedback and reduced-motion-aware chart transitions. No continuous animation or motion that delays workout logging.
