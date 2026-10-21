# CLAUDE.md — Project Management Console

This file is read by Claude Code on every session. It defines the stack, conventions and design system for the app. **Follow it for every change.** If a prompt conflicts with this file, ask before deviating.

## Product

A single-user web app for project management, monitoring and planning (SAP-style consulting engagements). Tabs:

| #   | Tab                                                         | Status                                |
| --- | ----------------------------------------------------------- | ------------------------------------- |
| 1   | Project Settings (General, Project Schedule, Team Forecast) | Build now                             |
| 2   | Planning                                                    | Placeholder                           |
| 3   | Monitoring                                                  | Placeholder                           |
| 4   | Forecast vs Actual                                          | Placeholder (uses forecast baselines) |
| 5   | Reports                                                     | Placeholder                           |

## Stack (do not change without asking)

- **Vite + React 18 + TypeScript** (strict mode)
- **Tailwind CSS** for styling, with design tokens in `tailwind.config.ts` (below)
- **shadcn/ui** components (Radix primitives) — Button, Input, Select, Dialog, Tabs, Tooltip, Table, DropdownMenu, Badge, Card, Toast (sonner)
- **lucide-react** for all icons — no other icon sets, no emoji as icons
- **Zustand** with `persist` middleware for state, stored in `localStorage` under key `pm-console-v1`
- **date-fns** for all date math (never hand-roll date arithmetic)
- **zod** + **react-hook-form** for forms and validation
- **Vitest** + **React Testing Library** for tests
- **React Router** (HashRouter — required for GitHub Pages)
- Deploy: **GitHub Pages** via GitHub Actions on push to `main`

## Folder structure

```
src/
  app/            # App shell, router, providers
  components/ui/  # shadcn components (generated)
  components/     # shared app components (PageHeader, SectionCard, IconButton, EmptyState, StatTile)
  features/
    auth/         # PIN login
    settings/     # Project Settings tab: general/, schedule/, team/, baselines/
    planning/ monitoring/ forecast-vs-actual/ reports/
  store/          # Zustand slices + types
  lib/            # date helpers, money/format helpers, calculations (pure functions)
  test/
```

Business calculations live in `src/lib/` as **pure, unit-tested functions** — never inside components.

## Design system

**Feel:** calm, dense-but-readable enterprise dashboard. Light theme default, dark theme supported via `class` strategy.

### Colors (Tailwind tokens)

| Token                | Light                 | Use                                          |
| -------------------- | --------------------- | -------------------------------------------- |
| `primary`            | `#2563EB` (blue-600)  | Primary actions, active tab, focus ring      |
| `primary-foreground` | `#FFFFFF`             | Text on primary                              |
| `surface`            | `#FFFFFF`             | Cards                                        |
| `background`         | `#F8FAFC` (slate-50)  | Page background                              |
| `border`             | `#E2E8F0` (slate-200) | All borders, dividers                        |
| `muted`              | `#64748B` (slate-500) | Secondary text, helper text                  |
| `success`            | `#16A34A`             | Positive margin, on-track                    |
| `warning`            | `#D97706`             | Overallocation (>100%), at-risk              |
| `danger`             | `#DC2626`             | Errors, negative margin, destructive actions |

Phase colors: a fixed palette of 8 accessible colors in `src/lib/palette.ts`, assigned in order.

### Typography

- Font: **Inter** (Google Fonts), fallback `system-ui, sans-serif`. Numbers in tables use `tabular-nums`.
- Scale (use these classes only):
  - Page title (H1): `text-2xl font-semibold tracking-tight`
  - Section title (H2): `text-lg font-semibold`
  - Card / sub-section title (H3): `text-base font-medium`
  - Body: `text-sm`
  - Helper / caption: `text-xs text-muted`
  - Table header: `text-xs font-medium uppercase tracking-wide text-muted`

### Layout

- App shell: fixed top bar (app name + project name + logout) and a horizontal tab bar below it. Content max width `max-w-7xl`, padding `px-6 py-6`.
- Every page starts with the shared **`<PageHeader icon title description actions />`** component. Never build ad-hoc headers.
- Every section sits in a **`<SectionCard icon title description actions>`** (rounded-xl, border, shadow-sm, p-5).
- Spacing: 4/8-point grid; gaps `gap-4` within cards, `gap-6` between cards.
- Radius: `rounded-lg` controls, `rounded-xl` cards.

### Buttons, icons and tooltips (mandatory)

- Every button has a lucide icon (16px, `h-4 w-4`) **and** a tooltip.
- Icon-only buttons must use the shared `<IconButton icon label tooltip />` which also sets `aria-label`.
- Tooltips: shadcn `Tooltip`, 300 ms delay, short sentence-case text describing the result ("Add a new project phase"), and include a keyboard shortcut if one exists.
- Variants: `default` (primary), `outline` (secondary), `ghost` (row actions), `destructive` (delete — always behind a confirmation dialog).
- Standard icon mapping (use consistently):
  | Action              | Icon            |
  | ------------------- | --------------- |
  | Add                 | `Plus`          |
  | Edit                | `Pencil`        |
  | Delete              | `Trash2`        |
  | Save                | `Save`          |
  | Cancel              | `X`             |
  | Duplicate           | `Copy`          |
  | Baseline / version  | `GitBranch`     |
  | Lock                | `Lock`          |
  | Calendar / schedule | `CalendarRange` |
  | Team                | `Users`         |
  | Settings            | `Settings`      |
  | Planning            | `ClipboardList` |
  | Monitoring          | `Activity`      |
  | Forecast vs Actual  | `BarChart3`     |
  | Reports             | `FileText`      |
  | Logout              | `LogOut`        |
  | Info hint           | `Info`          |
  | Export              | `Download`      |

### Forms and tables

- Labels above inputs, helper text below in caption style, errors in `text-danger text-xs`.
- Number inputs right-aligned; currency formatted with `Intl.NumberFormat` using the project currency.
- Tables: sticky header, zebra rows off, row hover `bg-slate-50`, row actions right-aligned, empty state with icon + one-line hint + primary action.
- Calculated (read-only) fields shown with a subtle `bg-slate-50` background and an `Info` tooltip explaining the formula.

### Feedback

- Toasts (sonner) for save/delete/baseline success; inline errors for validation.
- Destructive actions always confirm via Dialog.

## Accessibility

Keyboard reachable everything, visible focus ring (`ring-2 ring-primary`), `aria-label` on icon buttons, color is never the only signal (pair with icon or text).

## Quality bar for every task

1. `npm run lint`, `npm run typecheck`, `npm test` all pass.
2. New calculations have unit tests.
3. No `any`. No inline styles. No new dependencies without saying why.
4. Commit with a conventional message (`feat:`, `fix:`, `chore:`) and push to `main` when the task is complete.
5. Summarize what changed and anything you assumed.
