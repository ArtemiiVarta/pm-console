# PM Console

Project management, planning and monitoring console for SAP-style consulting engagements. A small team signs in with Google and works on the same projects, which are saved continuously to a private GitHub repository.

**Specification:** [docs/SPECIFICATION.md](docs/SPECIFICATION.md) — what the console does, its architecture, business rules, data model, API and security, at a high level.

**Production:** https://artemiivarta.github.io/pm-console-app/ — the tested version, for real projects.
**Staging:** https://artemiivarta.github.io/pm-console/ — every change lands here first for testing (marked with a **Staging** badge).

> **Access.** Only people an admin has added can sign in (with Google). Project data never ships with the site: it lives in a private GitHub repository and is served only to signed-in people by the PM Console API (`/worker`).

## Features

- **Sign in with Google** — only people on the access list; a sign-in lasts 30 days per browser. **Log out** saves, then clears that browser's copy of the projects.
- **Admin** (admins only) — add people by Google email as _admin_ or _user_, change roles, remove access (applies within about 30 seconds). The owner is always an admin.
- **Projects (home page)** — every project as a treemap: tile size follows forecast revenue, color follows status (Green / Amber / Red). Click a tile to open the project; **New project** creates one and opens its details. A table below lists all projects with open and delete actions.
- **Project Settings › General** — project name, client, status (Green by default, Amber, Red) with an optional rationale, currency, standard hours per week, and whether phase days count working days (Mon–Fri) or calendar days. Summary tiles for start, end, duration, team size, forecast hours and margin.
- **Project Settings › Project Schedule** — one Gantt chart: phases › tasks › sub-tasks, with milestones at every level (★) and project milestones. Drag bars to move them (children move along), drag their edges to change start or end, drag stars to move milestones; keyboard: ←/→ move, Shift+←/→ end, Alt+←/→ start. Parents can follow their children (start = earliest child start, end = latest child end), kept in sync. Colors per bar and star, overlap and gap warnings between phases, collapse/expand, today marker.
- **Project Settings › Team Forecast**
  - Totals: hours, development capacity, cost, revenue, margin and margin %.
  - Team roster with start date, allocation, developer capacity, rates, margin per hour, planned hours and margin, sorting, role filter, active/inactive members, and a Show/Hide financials switch.
  - Planned allocation grid: load % or hours per person per week, phase bands, overallocation warnings, keyboard editing, range selection with bulk Set / Reset / Fill right, and weekly totals. Edits stay unsaved (dashed outline) until you click **Save changes** or **Discard**.
  - Baselines (versions): locked snapshots you can view read-only, compare (any two versions, per member), restore, and choose for Forecast vs Actual. A badge shows when the forecast has changed since the last baseline.
- **Forecast vs Actual** — choose the baseline to compare against (actuals are coming next).
- **Planning, Monitoring, Reports** — coming soon.
- **Always-on GitHub sync** — every project is saved to a private repository while you work: about 1.5 seconds after each change and when you leave the page; changes from other computers appear within 15 seconds; tabs in one browser stay in step. If two people change the same data at once, you choose which version to keep. The cloud icon in the top bar shows the sync state.
- **Export / Import** — download all projects as a JSON backup and restore them later (import asks before overwriting).
- Light and dark themes; works with keyboard only; usable from 1024 px wide.

## Usage guide

1. **Sign in with Google.** Use **Log out** (top right) on shared computers.
2. **Projects:** click **New project**, or click a tile to open an existing one. The current project's name is shown in the top bar.
3. **General:** enter the project name, client, status (add a rationale for Amber or Red) and currency, set the standard hours per week (100% load), choose how phase days are counted, then **Save**.
4. **Project Schedule:** **Add › Phase** for each phase and **Add › Milestone** for project key dates. Use a row's **⋯** menu to add tasks and milestones under a phase, or sub-tasks and sub-milestones under a task; tick **Adjust phase/task start/end date** to keep the parent fitted to its children. Drag bars and stars on the chart to change dates, or edit them from the ⋯ menu. Amber warnings flag overlapping phases and gaps.
5. **Team Forecast → Team members:** **Add team member** with role, start date (weeks before it count as 0%), allocation, developer capacity and cost/price rates. The dialog previews margin per hour. Deactivate people to keep them but leave them out of totals. **Hide financials** collapses cost, price and margin.
6. **Team Forecast → Planned allocation:** click a cell and type a value (Enter or Tab moves on, Esc cancels, an empty value goes back to the allocation). Switch **Load % / Hours** to work in either unit. Select a range with Shift+click, drag or Shift+arrows for bulk changes; use the row menu (⋯) to apply a % to a date range. Then **Save changes** (Ctrl+S) or **Discard**.
7. **Create baseline** when the forecast is agreed. Use **Versions** to view, compare, restore or pick the baseline for Forecast vs Actual.
8. **People (admins):** open **Admin**, enter a Google email, pick _User_ or _Admin_, **Add person**. They can sign in right away.
9. **Back up anyway:** use **Export** (download icon, top bar) now and then and keep the file safe; **Import** (upload icon) restores it on any browser.

## Stack

Vite + React 18 + TypeScript (strict), Tailwind CSS, shadcn/ui (Radix), lucide-react, Zustand, date-fns, zod + react-hook-form, React Router (HashRouter), Vitest + React Testing Library. See [CLAUDE.md](CLAUDE.md) for conventions and the design system.

## Setup

Requires Node.js 22+.

```bash
npm install
npm run dev
```

Open the URL Vite prints (http://localhost:5173/pm-console/).

## Local testing

`npm run dev` adds **Test admin** and **Test user** buttons to the sign-in page. They sign in without Google against an in-browser stand-in for the API (projects and people are kept in that browser's storage), so every page, the Admin tab and sync can be tried with test data. This mode exists only in the dev server; Staging and Production builds do not contain it.

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

Two environments, both on GitHub Pages:

|                  | Staging                                              | Production                                                                                             |
| ---------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| URL              | https://artemiivarta.github.io/pm-console/           | https://artemiivarta.github.io/pm-console-app/                                                         |
| Deployed         | automatically on every push to `main` (`deploy.yml`) | by hand (`deploy-production.yml`)                                                                      |
| Hosted from      | this repository                                      | built files on branch `gh-pages` of [`pm-console-app`](https://github.com/ArtemiiVarta/pm-console-app) |
| GitHub data file | `pm-console-data` › `staging/projects.json`          | `pm-console-data` › `projects.json`                                                                    |
| Browser storage  | `pm-console-*` keys                                  | `pm-console-prod-*` keys                                                                               |

**Release flow**

1. Push to `main`. _Deploy to Staging_ runs lint → typecheck → test → build and publishes Staging.
2. Test on Staging. Its projects are separate, so testing never touches real data.
3. Open **Actions › Deploy to Production › Run workflow**. Leave _Commit_ empty to ship exactly the version on Staging (the last successful Staging deploy), or enter a commit SHA to ship or roll back to a specific version. It runs the tests, builds with `VITE_APP_ENV=production` and pushes to `pm-console-app`; the site updates about a minute later.

The workflow writes to `pm-console-app` with a deploy key stored as the `PRODUCTION_DEPLOY_KEY` secret. The build reads `VITE_APP_ENV` (`production`, otherwise Staging) to choose the base path, storage keys, data file and the Staging badge — see `src/lib/env.ts`. `VITE_API_URL` and `VITE_GOOGLE_CLIENT_ID` (both public) come from `.env`.

### PM Console API (`/worker`)

A Cloudflare Worker that both sites use. It verifies Google sign-ins, issues 30-day sessions, checks each person's role on every request (`users.json` in the data repository; `OWNER_EMAIL` is always an admin), and reads and writes `projects.json` / `staging/projects.json`. The only GitHub token lives in its secrets, never in a browser.

Setup (once):

1. Google Cloud › Google Auth Platform: create a **Web application** client with JavaScript origins `https://artemiivarta.github.io` and `http://localhost:5173`; publish the app. Put the client ID in `.env` and `worker/wrangler.toml` (`GOOGLE_CLIENT_ID`).
2. Cloudflare: `npx wrangler login`, then `npm run worker:deploy` and put the printed `*.workers.dev` URL in `.env` (`VITE_API_URL`).
3. Secrets: `npx wrangler secret put GITHUB_TOKEN --config worker/wrangler.toml` (fine-grained token, Contents read and write on `pm-console-data` only) and `npx wrangler secret put SESSION_SECRET --config worker/wrangler.toml` (a long random string).

Redeploy the API with `npm run worker:deploy` after changing `/worker`.
