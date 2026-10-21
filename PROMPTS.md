# Claude Code Prompt Pack — Project Management Console

**How to use:** run these prompts in Claude Code **one at a time, in order**. Wait for each to finish, check it in the browser (`npm run dev`), then run the next. Put `CLAUDE.md` in the repo root first (Prompt 0 does this) — every later prompt relies on it.

> **Security note on the PIN:** a static site on GitHub Pages has no server, so the PIN check runs in the browser. It keeps casual visitors out but is not real security. The prompts below store only a SHA-256 hash of the PIN (never `2783` in plain text) and create the repo as **private**. If you later need real access control, move to a backend (e.g. Supabase auth) — ask Claude Code when you reach that point.

---

## Prompt 0 — Repository, scaffold and deployment

```
Create a new project called "pm-console" and publish it to GitHub under the account ArtemiiVarta.

1. Check that the GitHub CLI is installed and authenticated (`gh auth status`). If not, stop and tell me what to run.
2. Create a PRIVATE repo: `gh repo create ArtemiiVarta/pm-console --private --description "Project management, planning and monitoring console"`.
3. Scaffold Vite + React + TypeScript (strict) in it.
4. Add the CLAUDE.md file I've provided in the repo root (I'll paste it / it's already in this folder) and follow it from now on.
5. Install and configure the full stack from CLAUDE.md: Tailwind with the design tokens, shadcn/ui (Button, Input, Label, Select, Dialog, Tabs, Tooltip, Table, DropdownMenu, Badge, Card, Popover, Calendar, Switch, sonner), lucide-react, zustand, date-fns, zod, react-hook-form, @hookform/resolvers, react-router-dom, vitest, @testing-library/react, eslint, prettier.
6. Load the Inter font and set up light/dark theme tokens.
7. Add npm scripts: dev, build, preview, lint, typecheck, test.
8. Configure GitHub Pages deployment:
   - `vite.config.ts` base = "/pm-console/"
   - Use HashRouter
   - Add `.github/workflows/deploy.yml` that runs lint, typecheck, test, build, then deploys `dist` with actions/deploy-pages on every push to main.
   - Enable Pages for the repo with source "GitHub Actions" (`gh api` call). Note: GitHub Pages on a private repo needs a paid GitHub plan — if the call fails for that reason, tell me and offer to make the repo public instead.
9. Add a README with setup, scripts and the deployed URL (https://artemiivarta.github.io/pm-console/).
10. Commit "chore: scaffold pm-console" and push. Confirm the Actions run succeeds and give me the live URL.
```

---

## Prompt 1 — Shared components and app shell

```
Build the app shell and shared components exactly per CLAUDE.md.

Shared components in src/components/:
- PageHeader({ icon, title, description, actions })
- SectionCard({ icon, title, description, actions, children })
- IconButton({ icon, label, tooltip, variant, onClick }) — sets aria-label, always wrapped in a Tooltip
- ActionButton({ icon, children, tooltip, variant, ... }) — standard button with icon + tooltip
- EmptyState({ icon, title, hint, action })
- StatTile({ icon, label, value, hint, tone }) — small KPI tile, tone = default|success|warning|danger
- ConfirmDialog({ title, description, confirmLabel, onConfirm }) — used for every delete
- CalculatedField({ label, value, formula }) — read-only, muted background, Info tooltip showing the formula

App shell:
- Top bar: app icon + "PM Console", current project name (from store, "Untitled project" if empty), theme toggle IconButton, Logout IconButton.
- Tab bar with icons (from the CLAUDE.md icon table): Project Settings, Planning, Monitoring, Forecast vs Actual, Reports. Each tab is a route (#/settings, #/planning, ...). Default route = /settings.
- Planning, Monitoring, Forecast vs Actual, Reports: show PageHeader + EmptyState "Coming soon".
- Wrap the app in TooltipProvider (delayDuration 300) and the sonner Toaster.

Add a /dev/components route (only in dev builds) that shows every shared component with sample props so I can check visual consistency.

Write tests for IconButton (has aria-label, tooltip text renders on focus). Commit and push.
```

---

## Prompt 2 — PIN login page

```
Add a PIN login page that gates the whole app.

Requirements:
- Route /login. All other routes redirect to /login when not authenticated.
- Centered card on the background color: app icon (lucide `LockKeyhole`), title "PM Console", caption "Enter your 4-digit PIN".
- Four separate single-digit input boxes (type=password, inputMode=numeric, autocomplete="one-time-code"):
  - auto-advance on digit, Backspace moves to the previous box, paste of 4 digits fills all boxes
  - auto-submit when the 4th digit is entered; also an "Unlock" button (icon `LogIn`, tooltip "Unlock the console")
  - "Show PIN" toggle IconButton (`Eye` / `EyeOff`)
- The correct PIN is 2783. Do NOT store it in plain text anywhere in the code. Store its SHA-256 hash in `src/features/auth/pin.ts` as a constant, and compare the hash of the entered PIN using the Web Crypto API (crypto.subtle.digest). Add a short comment explaining that client-side PIN checks are a convenience lock, not real security.
- Wrong PIN: shake animation on the boxes, clear them, inline error "Incorrect PIN". After 5 wrong attempts, lock input for 30 seconds with a visible countdown.
- On success: store a session flag in sessionStorage (so closing the tab logs out), navigate to the page the user originally requested (or /settings).
- Logout button in the top bar clears the session and returns to /login.
- Keyboard accessible, focus starts in the first box.

Tests: correct PIN unlocks, wrong PIN shows error and clears, lockout after 5 attempts, paste fills boxes. Commit and push.
```

---

## Prompt 3 — Data model and store for Project Settings

```
Create the data model and Zustand store for the Project Settings tab. No UI yet except what's needed to verify. Put types in src/store/types.ts, calculations in src/lib/ as pure functions with unit tests.

Types:

Project {
  id, name, client, currency (default "CAD"), standardHoursPerWeek (default 40),
  durationMode: "working" | "calendar"  // how "days" are counted for phases; default "working" (Mon–Fri)
  createdAt, updatedAt
}

Phase {
  id, name, color (from palette), order,
  startDate (ISO date), duration (number > 0), durationUnit: "days" | "weeks",
  notes?
}
// endDate is DERIVED, never stored:
//   weeks → startDate + duration*7 calendar days − 1
//   days + calendar → startDate + duration − 1
//   days + working → add `duration` working days (skip Sat/Sun), the start day counts as day 1 if it's a weekday

TeamMember {
  id, firstName, lastName, email, role,
  defaultLoadPct (0–200, default 100),       // % of standardHoursPerWeek
  weeklyOverrides: Record<weekStartISO, number>, // load % for a specific week; absent = use default
  capacityPct (0–100, default 100),          // share of assigned time that counts as productive/development capacity
  costRate (per hour), priceRate (per hour),
  active: boolean
}

ForecastBaseline {
  id, name, description?, createdAt, isLocked: true,
  snapshot: { project: Project, phases: Phase[], members: TeamMember[] }  // deep copy at creation
  totals: { hours, cost, revenue, margin, marginPct }                     // computed at creation
}

Store state: project, phases, members, baselines, selectedBaselineId (for Forecast vs Actual), plus CRUD actions for each, reorderPhases, setWeeklyOverride(memberId, weekStart, pct), clearWeeklyOverride, applyLoadToRange(memberId, fromWeek, toWeek, pct), createBaseline(name, description), deleteBaseline(id), selectBaseline(id).

Pure functions in src/lib/ (all unit-tested, including edge cases):
- getPhaseEndDate(phase, durationMode)
- getProjectRange(phases) → { start, end } | null  (earliest start, latest end)
- getProjectWeeks(range) → array of week-start dates (weeks start Monday, date-fns startOfWeek weekStartsOn: 1)
- getMemberLoadPct(member, weekStart)
- getMemberHours(member, weekStart, standardHoursPerWeek) = loadPct/100 × standardHoursPerWeek
- getMemberCapacityHours(...) = hours × capacityPct/100
- getMemberTotals(member, weeks, std) → { hours, capacityHours, cost, revenue, margin, marginPct }
    cost = hours × costRate; revenue = hours × priceRate; margin = revenue − cost;
    marginPct = margin / revenue (0 if revenue is 0)
- getRateMargin(costRate, priceRate) → { marginPerHour, marginPct }
- getTeamTotals(...) and getWeeklyTeamTotals(...) (per week: hours, capacityHours, cost, revenue)

Persist with zustand persist (key pm-console-v1, include a `version` and a migrate function stub). Seed nothing — start empty. Commit and push.
```

---

## Prompt 4 — Project Settings tab: layout and General section

```
Build the Project Settings tab (route /settings) per CLAUDE.md.

- PageHeader: icon Settings, title "Project Settings", description "Define the project, its schedule and the team forecast."
- Secondary navigation inside the page: shadcn Tabs (pill style) with icons — "General" (Info), "Project Schedule" (CalendarRange), "Team Forecast" (Users). Sync selected sub-tab to the URL (#/settings/general, /schedule, /team).

General sub-tab — SectionCard "Project details":
- Fields: Project name (required), Client, Currency (Select: CAD, USD, EUR, GBP), Standard hours per week (number, 1–80), Count phase days as (Select: Working days Mon–Fri / Calendar days) with an Info tooltip explaining the difference.
- react-hook-form + zod, Save (Save icon, tooltip "Save project details") and Reset (RotateCcw, tooltip "Discard unsaved changes") buttons. Save shows a toast.
- Below: a row of StatTiles (read-only, from the store): Project start, Project end, Duration (weeks), Team members, Forecast hours, Forecast margin %.

Commit and push.
```

---

## Prompt 5 — Project Schedule: phases

```
Build the "Project Schedule" sub-tab.

SectionCard "Phases" (icon CalendarRange) with action button "Add phase" (Plus, tooltip "Add a new project phase").

Phase table columns: drag handle (GripVertical) | color dot | Phase name | Start date | Duration | Unit | End date (calculated, CalculatedField-style with formula tooltip) | Actions.
- Inline editing: click a row's Edit (Pencil) or double-click a cell. Start date uses the shadcn date picker (Popover + Calendar). Duration is a number input; Unit is a Select (Days / Weeks).
- End date recalculates live using getPhaseEndDate and the project's durationMode; show "(working days)" or "(calendar days)" in the helper text when unit = Days.
- Row actions: Edit, Duplicate (Copy, tooltip "Duplicate this phase"), "Start after previous" (ArrowRightToLine, tooltip "Set start date to the day after the previous phase ends"), Delete (Trash2, ConfirmDialog).
- Drag to reorder (use @dnd-kit/sortable; explain the dependency in the summary).
- Add phase dialog: name, start date (defaults to the day after the last phase ends, or today if none), duration, unit. Validation: name required, duration > 0 integer.
- Warnings (warning color + AlertTriangle icon + tooltip, not blocking): phases overlapping, or a gap between consecutive phases.
- Empty state: icon CalendarRange, "No phases yet", hint "Add your first phase to define the project timeline", action "Add phase".

Below the table, SectionCard "Timeline" — a simple Gantt view:
- Horizontal bars per phase on a week scale (week labels = Monday dates, format "dd MMM"), bar color = phase color, today marker line.
- Hover tooltip on bar: name, start–end, duration.
- Built with plain CSS grid / divs (no chart library).

Tests: end-date calculation shown correctly for days/weeks and working/calendar modes; overlap detection. Commit and push.
```

---

## Prompt 6 — Team Forecast: team members

```
Build the "Team Forecast" sub-tab, part 1: the team roster.

Top of page: a baseline bar (built in Prompt 8 — leave a placeholder slot now) and a row of StatTiles: Total forecast hours, Development capacity hours, Total cost, Total revenue, Margin (amount), Margin %. Margin tile tone: success ≥ 25%, warning 10–25%, danger < 10%.

SectionCard "Team members" (icon Users), action "Add team member" (UserPlus, tooltip "Add a person to the forecast").

Add/Edit dialog (react-hook-form + zod):
- First name*, Last name*, Email* (valid email, unique within project), Role* (combobox with suggestions: Project Manager, Solution Architect, Functional Consultant, Technical Consultant, Developer, Integration Developer, QA Analyst, Business Analyst — free text allowed)
- Default load % (0–200, default 100) with helper "100% = {standardHoursPerWeek} h/week"
- Capacity % (0–100, default 100) with Info tooltip "Share of assigned hours counted as development capacity (e.g. 80% if 20% goes to meetings/admin)"
- Cost rate /h, Price rate /h (currency from project)
- Calculated preview inside the dialog: Margin/h and Margin % (CalculatedField with formula tooltips), turns danger color if negative.

Roster table columns: Name (initials avatar + full name + email under it) | Role | Default load % | Weekly hours | Capacity % | Cost/h | Price/h | Margin/h | Margin % | Total hours | Total margin | Actions (Edit, Duplicate, Deactivate/Activate toggle (UserX/UserCheck), Delete with confirm).
- Totals row at the bottom.
- Inactive members shown greyed and excluded from totals.
- Sort by any column; filter by role.
- Empty state: Users icon, "No team members yet", action "Add team member".

If there are no phases yet, show an inline notice (Info icon) linking to Project Schedule: "Add phases to set the project duration — weekly assignments depend on it."

Tests: margin calculations, totals exclude inactive members, duplicate email rejected. Commit and push.
```

---

## Prompt 7 — Team Forecast: weekly assignment grid

```
Build the "Team Forecast" sub-tab, part 2: the weekly assignment grid, below the roster.

SectionCard "Weekly assignment" (icon CalendarDays).

Grid:
- Rows = active team members; columns = every project week from getProjectWeeks (Monday dates, "dd MMM"), grouped under phase headers (a week belongs to the phase(s) it overlaps; show phase color band above the week columns).
- Left sticky columns: Name, Role, Default %. Right sticky column: Total hours. Horizontal scroll for weeks. Sticky header row.
- Display toggle (segmented control): "Load %" / "Hours" — the cell shows either the % or the computed hours; editing works in both modes (hours convert back to %).
- Cells: default values shown in muted text; overridden values shown in normal weight with a small dot indicator; tooltip on hover: "Week of {date} · {pct}% · {hours} h · capacity {capHours} h".
- Edit: click a cell to type, Enter/Tab moves to the next cell, Escape cancels. Arrow-key navigation between cells.
- Cell colors: 0% muted, >100% warning background with AlertTriangle icon (overallocation), never color alone.
- Multi-select a range of cells (shift+click or drag) then a toolbar appears: "Set load %…" (Percent icon), "Reset to default" (RotateCcw, tooltip "Remove weekly overrides and use the default load"), "Fill right" (ArrowRight, tooltip "Copy the first selected value across the selection").
- Per-row action menu (MoreHorizontal): "Apply % to a date range…" (dialog with from/to week + %), "Reset all weeks to default".
- Footer rows: Total hours per week, Development capacity per week, Cost per week, Revenue per week.

Performance: memoize per-cell calculations; the grid must stay smooth with 25 members × 78 weeks.

Tests: override changes hours and totals; reset removes override; hours-mode edit converts to correct %. Commit and push.
```

---

## Prompt 8 — Forecast baselines (versions)

```
Add forecast baselines (versions) to the Team Forecast sub-tab. Baselines will later be compared against actuals in the "Forecast vs Actual" tab.

Baseline bar at the top of Team Forecast:
- Shows "Working forecast" badge (editable, the live data) and, if any exist, "Latest baseline: {name} · {date}".
- Button "Create baseline" (GitBranch, tooltip "Save a locked snapshot of the current forecast for Forecast vs Actual comparison").
  Dialog: Name (default "Baseline {n} – {dd MMM yyyy}"), Description (optional), and a summary preview of what will be captured (members, weeks, hours, cost, revenue, margin %). Confirm creates the snapshot via createBaseline — deep copy of project, phases and members, totals precomputed. Toast on success.
- Button "Versions" (History, tooltip "View and compare saved baselines") opens a side Sheet:
  - List of baselines newest first: name, created date, description, totals (hours, cost, margin %), Lock icon (baselines are read-only).
  - Per baseline: "View" (Eye — opens a read-only version of the roster + weekly grid rendered from the snapshot, with a banner "Viewing baseline {name} — read only" and a "Back to working forecast" button), "Use for Forecast vs Actual" (Target — sets selectedBaselineId, shows a check badge on the selected one), "Restore to working forecast" (RotateCcw — confirm dialog warns it overwrites current phases and team), "Delete" (Trash2, confirm; block deleting the selected baseline unless another is selected first).
  - "Compare" mode: pick two versions (any baseline or the working forecast) and show a diff table per member: hours, cost, revenue, margin — with deltas colored success/danger and ▲/▼ icons, plus a totals row.
- Baselines are immutable: no action edits a snapshot.
- If there are unsaved differences between the working forecast and the latest baseline, show a subtle "Changed since last baseline" badge (CircleDot icon, warning tone) in the bar.

On the Forecast vs Actual placeholder page, add a baseline Select (with the selected one preselected) so the selection is visible there already; keep the rest "Coming soon".

Tests: snapshot is a deep copy (editing working data doesn't change a baseline), restore replaces working data, compare deltas are correct, selected baseline can't be deleted. Commit and push.
```

---

## Prompt 9 — Consistency and quality pass

```
Do a full consistency pass on everything built so far against CLAUDE.md:
1. Every button has an icon and a tooltip; every icon-only button uses IconButton with aria-label. List any you fixed.
2. Every page/section uses PageHeader / SectionCard; typography classes match the scale exactly.
3. Icons match the mapping table.
4. Light and dark themes both look correct; check the login page, schedule, roster, grid and baseline sheet.
5. Keyboard-only walkthrough: login → add phase → add member → edit a week → create baseline.
6. Responsive down to 1024px wide (grid scrolls horizontally, nothing overlaps).
7. Add Export/Import JSON buttons to the top bar (Download / Upload icons, tooltips "Download all data as a backup file" / "Restore data from a backup file", import confirms before overwriting) — since data lives in this browser only.
8. Run lint, typecheck, tests, build. Fix all issues. Update README with a feature list and screenshots-free usage guide.
Commit "chore: consistency pass" and push; confirm the GitHub Pages deploy succeeded.
```

---

## Next tabs (to write after Project Settings is done)
- **Planning** — tasks/backlog per phase, sprint capacity from the Team Forecast capacity hours.
- **Monitoring** — actual hours entry or CSV import, RAG status, risks/issues log.
- **Forecast vs Actual** — selected baseline vs actuals by week/member/phase, variance charts.
- **Reports** — status report export.
