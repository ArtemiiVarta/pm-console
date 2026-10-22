# PM Console

Project management, planning and monitoring console for SAP-style consulting engagements. Single-user, runs entirely in the browser (data in `localStorage`).

**Live:** https://artemiivarta.github.io/pm-console/

> **Access note.** The PIN screen is a convenience lock, not security: this is a static site and the repository is public. Do not store confidential client data here. Proper sign-in (Google account) is planned.

## Features

- **PIN login** — 4-digit PIN with auto-advance, paste, show/hide and a 30-second lock after 5 wrong attempts. Closing the tab signs you out.
- **Project Settings › General** — project name, client, currency, standard hours per week, and whether phase days count working days (Mon–Fri) or calendar days. Summary tiles for start, end, duration, team size, forecast hours and margin.
- **Project Settings › Project Schedule** — one Gantt chart: phases › tasks › sub-tasks, with milestones at every level (★) and project milestones. Drag bars to move them (children move along), drag their edges to change start or end, drag stars to move milestones; keyboard: ←/→ move, Shift+←/→ end, Alt+←/→ start. Parents can follow their children (start = earliest child start, end = latest child end), kept in sync. Colors per bar and star, overlap and gap warnings between phases, collapse/expand, today marker.
- **Project Settings › Team Forecast**
  - Totals: hours, development capacity, cost, revenue, margin and margin %.
  - Team roster with start date, allocation, developer capacity, rates, margin per hour, planned hours and margin, sorting, role filter, active/inactive members, and a Show/Hide financials switch.
  - Planned allocation grid: load % or hours per person per week, phase bands, overallocation warnings, keyboard editing, range selection with bulk Set / Reset / Fill right, and weekly totals. Edits stay unsaved (dashed outline) until you click **Save changes** or **Discard**.
  - Baselines (versions): locked snapshots you can view read-only, compare (any two versions, per member), restore, and choose for Forecast vs Actual. A badge shows when the forecast has changed since the last baseline.
- **Forecast vs Actual** — choose the baseline to compare against (actuals are coming next).
- **Planning, Monitoring, Reports** — coming soon.
- **Export / Import** — download all data as a JSON backup and restore it later (import asks before overwriting).
- Light and dark themes; works with keyboard only; usable from 1024 px wide.

## Usage guide

1. **Unlock** with your PIN. Use **Log out** (top right) to lock again.
2. **General:** enter the project name, client and currency, set the standard hours per week (100% load), choose how phase days are counted, then **Save**.
3. **Project Schedule:** **Add › Phase** for each phase and **Add › Milestone** for project key dates. Use a row's **⋯** menu to add tasks and milestones under a phase, or sub-tasks and sub-milestones under a task; tick **Adjust phase/task start/end date** to keep the parent fitted to its children. Drag bars and stars on the chart to change dates, or edit them from the ⋯ menu. Amber warnings flag overlapping phases and gaps.
4. **Team Forecast → Team members:** **Add team member** with role, start date (weeks before it count as 0%), allocation, developer capacity and cost/price rates. The dialog previews margin per hour. Deactivate people to keep them but leave them out of totals. **Hide financials** collapses cost, price and margin.
5. **Team Forecast → Planned allocation:** click a cell and type a value (Enter or Tab moves on, Esc cancels, an empty value goes back to the allocation). Switch **Load % / Hours** to work in either unit. Select a range with Shift+click, drag or Shift+arrows for bulk changes; use the row menu (⋯) to apply a % to a date range. Then **Save changes** (Ctrl+S) or **Discard**.
6. **Create baseline** when the forecast is agreed. Use **Versions** to view, compare, restore or pick the baseline for Forecast vs Actual.
7. **Back up regularly:** your data lives only in this browser. Use **Export** (download icon, top bar) and keep the file safe; **Import** (upload icon) restores it on any browser.

## Stack

Vite + React 18 + TypeScript (strict), Tailwind CSS, shadcn/ui (Radix), lucide-react, Zustand, date-fns, zod + react-hook-form, React Router (HashRouter), Vitest + React Testing Library. See [CLAUDE.md](CLAUDE.md) for conventions and the design system.

## Setup

Requires Node.js 22+.

```bash
npm install
npm run dev
```

Open the URL Vite prints (http://localhost:5173/pm-console/).

## Scripts

| Script               | What it does                           |
| -------------------- | -------------------------------------- |
| `npm run dev`        | Start the dev server with hot reload   |
| `npm run build`      | Type-check and build to `dist/`        |
| `npm run preview`    | Serve the production build locally     |
| `npm run lint`       | ESLint                                 |
| `npm run typecheck`  | TypeScript, no emit                    |
| `npm test`           | Run the Vitest suite once              |
| `npm run test:watch` | Vitest in watch mode                   |
| `npm run format`     | Prettier (with Tailwind class sorting) |

## Deployment

Every push to `main` runs `.github/workflows/deploy.yml`: lint → typecheck → test → build → deploy `dist/` to GitHub Pages.
