# PM Console

Project management, planning and monitoring console for SAP-style consulting engagements. Single-user, runs entirely in the browser (data in `localStorage`).

**Live:** https://artemiivarta.github.io/pm-console/

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
