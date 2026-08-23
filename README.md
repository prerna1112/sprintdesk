# SprintDesk

SprintDesk is a responsive sprint-management single-page application. It combines a persisted four-column task board, source-derived analytics, a compact dashboard, notifications, theme preferences, and a simulated refresh-token authentication lifecycle.

## Submission links

- **Public repository:** pending — no Git remote is configured.
- **Live deployment:** pending — no public deployment URL has been created yet.
- **Demo video:** recorded locally as `artifacts/SprintDesk-complete-project-screen-recording.mp4`; a public recording URL is pending.
- **Screenshots:** pending — screenshots have not been captured or checked into this repository.

The local video is a 98-second, 1280×720 H.264 screen-recording walkthrough with continuous typing, navigation, scrolling, task workflows, analytics, responsive views, and logout. It is intentionally excluded from Git. Entries still labelled pending are not claims that public release artifacts already exist.

## Demo account

The following public DummyJSON demo credentials were verified with the implemented login flow:

```text
Username: emilys
Password: emilyspass
```

Do not reuse these credentials for another service.

## Implemented features

### Required product work

- DummyJSON login, route guards, refresh-token restoration, single-flight refresh support, one authenticated-request retry, and logout.
- Dashboard with the current sprint summary, status totals, and upcoming sprint work.
- Board seeded from the first 30 validated mock tasks with Backlog, In Progress, Review, and Done columns.
- Pointer and keyboard task reordering within and across columns, including empty columns.
- Persisted create, view, edit, comment, delete, and task-ordering flows with validation and destructive confirmation.
- Analytics for sprint velocity, status distribution, priority breakdown, and completion trend, derived from the current board and supplied sprint history.
- Notifications seeded from mock data and polled from JSONPlaceholder every 20 seconds while visible, with deduplication, read state, pagination, persistence, and non-blocking errors.
- Light, dark, and system themes; responsive desktop/mobile navigation; accessible dialogs, drawers, toasts, loading states, and data tables.
- Lazy-loaded routes. Recharts is imported only by the analytics feature.

### Bonus work

- Keyboard-accessible drag and drop with live announcements is included.
- Board filters, undo, Remember Me, analytics date ranges/PNG export, axe-core, and Storybook are not implemented.

## Technology

React 18, TypeScript (strict mode), Vite 8, React Router 6, TanStack Query 5, Zustand 5, Tailwind CSS 3, dnd-kit, Recharts, Vitest, and React Testing Library.

## Local setup

Prerequisites: Node 22.12.0 and npm. The repository pins Node in `.nvmrc`; the package also accepts the Vite-supported Node 20.19+ line.

```bash
nvm use
npm ci
npm run dev
```

Open the URL printed by Vite and sign in with the demo account above. No environment variable is required.

Optionally copy `.env.example` to `.env` and set `VITE_API_BASE_URL` to a DummyJSON-compatible auth service. Vite exposes `VITE_*` values to browser code, so this variable must never contain a secret.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite development server. |
| `npm run lint` | Run ESLint with zero warnings allowed. |
| `npm run typecheck` | Type-check without emitting files. |
| `npm run test` | Run the Vitest suite once. |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run build` | Type-check and create the production bundle in `dist/`. |
| `npm run preview` | Serve the built bundle locally. |
| `npm run check` | Run lint, typecheck, tests, and the production build in sequence. |

## Architecture and state ownership

React Router owns route selection and lazy boundaries. TanStack Query owns remote/static fetch lifecycles. Zustand owns mutable shared client state: the board, notification history/read state, and theme preference. The auth access token and expiry live only in the in-memory auth store; an isolated storage adapter persists only the refresh token. Component state is reserved for transient form, modal, drawer, drag, and pagination state. Analytics are selectors over board state and the supplied sprint history, rather than a second mutable copy.

See [Architecture](docs/ARCHITECTURE.md) for diagrams and tradeoffs, [API contracts](docs/API.md) for exact consumed interfaces, and [Assumptions](docs/ASSUMPTIONS.md) for confirmed product decisions.

## Data sources and authentication disclaimer

- `public/mock-data.json` supplies six users, three sprints, the first 30 board tasks, five comments, and four initial notifications. The adapter validates the runtime shape and references before features consume it.
- DummyJSON supplies the demo login, refresh, and current-user responses.
- JSONPlaceholder supplies five static posts used to simulate notification polling.

Authentication is a browser-only demonstration, not production security. The access token is memory-only, but the refresh token is intentionally stored in namespaced `localStorage` to demonstrate restoration. `localStorage` is readable by same-origin JavaScript and is unsuitable for a real high-value session token; a production backend should use secure, `HttpOnly`, `SameSite` cookies, server-side authorization, CSRF controls, and a real logout/revocation endpoint.

React Router v6 is an assignment constraint. The current audit has two moderate Router advisories and zero high/critical findings. The relevant surface mitigations and migration advice are documented in [SECURITY.md](SECURITY.md); do not force-upgrade to Router v7.

## Accessibility, responsive behavior, and performance

The app uses semantic landmarks and headings, labelled fields and controls, visible focus rings, skip navigation, focus-trapped/restoring overlays, live regions, keyboard drag controls, textual chart summaries, initials fallbacks for failed avatars, and `prefers-reduced-motion` handling. The board uses 87vw snap columns below desktop and was designed for a 375px baseline. A final manual device/browser pass remains part of the submission checklist.

The 2026-08-23 local production build (Vite 8.2.2) measured these representative compressed assets:

| Asset | Gzip size |
|---|---:|
| Application bootstrap (`index`) | 7.60 kB |
| Board feature chunk | 23.54 kB |
| Analytics route chunk, including Recharts | 117.88 kB |
| Global CSS | 5.25 kB |

A Lighthouse 12.8.2 mobile navigation audit of the production build served locally at `/login` on 23 August 2026 scored **Performance 99**, **Accessibility 100**, **Best Practices 100**, and **SEO 100** (FCP/LCP 1.7 s, TBT 0 ms, CLS 0). This is [local release evidence](docs/LIGHTHOUSE.md), not a deployed-origin claim. After deployment, repeat the audit against the public origin and authenticated primary routes as described in the [Submission guide](docs/SUBMISSION.md).

## Testing and release checks

```bash
npm run check
npm audit --audit-level=high
shasum -a 256 public/mock-data.json
```

The `check` command includes a WCAG AA semantic-token contrast audit. The expected mock-data checksum is `1015e1bdc02d855b229122e164551b58a6993b9e3fbcf6568a185990d338157b`. The dependency audit command is expected to report the two documented moderate Router v6 advisories while passing the high-severity release gate.

## Known limitations

- Mock and JSONPlaceholder content is static; there is no application backend or multi-user synchronization.
- Polling always requests JSONPlaceholder post IDs 1–5, so a fresh profile naturally reaches nine notifications (four mock plus five polled) and does not naturally exceed the 20-item pagination threshold. Pagination is covered with test fixtures.
- Board edits, notification history/read state, refresh token, and theme preference are localStorage-only. Clearing site data resets them, and they do not follow the user to another browser.
- Access-token refresh uses a deliberately short one-minute lifetime for demonstration.
- The source dataset's current sprint is chosen as the sprint with the latest `startDate`; the board intentionally contains all first 30 source tasks rather than only that sprint.
- Public repository/deployment URLs, a hosted demo-video URL, screenshots, cross-browser device evidence, and deployed Lighthouse measurements are still pending. The local demo video has been produced and visually checked.

## Deployment

Both supported configurations build with `npm run build`, publish `dist`, preserve real asset/mock-data requests, and fall back application routes to `index.html`:

- **Vercel:** import the repository. `vercel.json` supplies the build, output, and SPA rewrite settings.
- **Netlify:** import the repository. `netlify.toml` supplies the build, publish, and non-forced SPA fallback settings.

No production environment variable is required. If `VITE_API_BASE_URL` is set in the provider UI, it must be the public base URL of a contract-compatible auth service. After deployment, verify direct navigation and refresh on `/login`, `/dashboard`, `/board`, and `/analytics`; then verify API CORS, persistence, logout, responsive layouts, and Lighthouse.

The final handoff checklist and a concise reviewer walkthrough are in [docs/SUBMISSION.md](docs/SUBMISSION.md).
