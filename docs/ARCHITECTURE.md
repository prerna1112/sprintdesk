# SprintDesk architecture

## System view

```mermaid
flowchart LR
  browser["Browser"] --> router["React Router v6\nlazy route boundaries"]
  router --> login["Login"]
  router --> shell["Protected app shell"]
  shell --> dashboard["Dashboard"]
  shell --> board["Board"]
  shell --> analytics["Analytics + Recharts"]
  shell --> notifications["Notification center"]

  login --> authQuery["TanStack mutation"]
  dashboard --> mockQuery["TanStack mock-data query"]
  board --> mockQuery
  analytics --> mockQuery
  notifications --> mockQuery
  notifications --> pollQuery["TanStack polling query"]

  authQuery --> authService["Auth service"]
  authQuery --> authStore
  authQuery --> refreshStorage
  authService --> dummy["DummyJSON auth"]
  mockQuery --> adapter["Runtime validator + DTO adapter"]
  adapter --> mock["/mock-data.json"]
  pollQuery --> placeholder["JSONPlaceholder posts"]

  board --> boardStore["Zustand board store"]
  analytics --> boardStore
  notifications --> notificationStore["Zustand notification store"]
  shell --> authStore["In-memory auth store"]
  shell --> themeStore["Zustand theme store"]

  boardStore --> localStorage[("localStorage")]
  notificationStore --> localStorage
  themeStore --> localStorage
  refreshStorage["Refresh-token storage adapter"]
  refreshStorage --> localStorage
```

Routes are lazy-imported in `src/app/App.tsx`. The protected shell is a separate lazy boundary. Recharts is imported only by `src/features/analytics/Analytics.tsx`, so chart code stays out of the login, dashboard, and board route chunks.

## Route structure

| Route | Guard | Main responsibility |
|---|---|---|
| `/login` | Guest only | Credentials and login mutation. |
| `/dashboard` | Authenticated | Current sprint and current-board summary. |
| `/board` | Authenticated | Persisted task workflow and comments. |
| `/analytics` | Authenticated | Board/source-derived charts and accessible summaries. |
| `*` | — | Redirect to `/login`; guards then resolve the correct destination. |

## State ownership

| State | Owner | Persistence |
|---|---|---|
| Mock dataset fetch/result | TanStack Query | Memory cache for the page lifetime; infinite stale time. |
| Notification poll lifecycle/error | TanStack Query | None. |
| Login mutation lifecycle/error | TanStack Query | None. |
| Access token, expiry, user, auth status/generation | Zustand auth store | Memory only. |
| Refresh token | Dedicated storage adapter | `sprintdesk.auth.refresh.v1` in localStorage. |
| Tasks, column order, comments | Zustand board store | Versioned `sprintdesk.board.v1` localStorage record. |
| Notifications, seen source IDs, read timestamps | Zustand notification store | Versioned `sprintdesk.notifications.v1` localStorage record. |
| Theme preference | Zustand theme store | Versioned `sprintdesk.theme.v1` localStorage record. |
| Forms, open overlays, current notification page, active drag | React component state | None. |
| Analytics chart models | Pure selectors | None; recomputed from board/source data. |

Board and notification persistence validate/migrate their records before use and fall back to in-memory state with a visible warning if durable storage is unavailable.

## Data loading and adaptation

```mermaid
flowchart TD
  request["GET /mock-data.json"] --> response{"HTTP success?"}
  response -->|No| routeError["Route error + manual retry"]
  response -->|Yes| parse["Parse unknown JSON"]
  parse --> validate["Validate collections, fields, dates, IDs, references"]
  validate -->|Invalid| routeError
  validate --> adapt["Map numeric IDs to strings\nin-progress to inProgress\navatar/message/read fields to domain names"]
  adapt --> first30["Keep first 30 tasks"]
  first30 --> queryCache["TanStack Query cache"]
  queryCache --> consumers["Dashboard / Board / Analytics / Notifications"]
```

Feature components consume domain models, never source DTOs. The checked-in source remains unmodified; its SHA-256 is recorded in the README and submission checklist.

## Authentication lifecycle

```mermaid
sequenceDiagram
  participant User
  participant UI as Login / route guard
  participant Store as In-memory auth store
  participant Storage as Refresh-token adapter
  participant API as DummyJSON

  User->>UI: Submit username and password
  UI->>API: POST /auth/login (expiresInMins: 1)
  API-->>UI: User + accessToken + refreshToken
  UI->>Storage: Persist refresh token
  UI->>Store: Keep user/access token/expiry in memory
  UI-->>User: Navigate to protected return path

  Note over UI,API: On a full browser reload
  UI->>Storage: Read validated refresh record
  alt refresh token exists
    UI->>API: POST /auth/refresh
    API-->>UI: New tokens
    UI->>API: GET /auth/me with Bearer token
    API-->>UI: Current user
    UI->>Store: Restore authenticated session
  else missing, corrupt, or rejected
    UI->>Storage: Clear refresh record
    UI->>Store: Clear session
    UI-->>User: Render /login
  end

  User->>UI: Logout
  UI->>Storage: Clear refresh token
  UI->>Store: Clear access token and user
  UI->>UI: Clear TanStack query cache
```

The authenticated fetch wrapper attaches exactly one Bearer token, pre-emptively refreshes near expiry, coordinates concurrent refreshes through a single promise, and retries a replayable request once after a 401. Streaming or already-consumed bodies are rejected rather than retried unsafely. Session generations prevent an old request from reviving a logged-out/replaced session.

## Board lifecycle

```mermaid
flowchart TD
  open["Open dashboard, board, or analytics"] --> hydrate["Hydrate versioned board store"]
  hydrate --> valid{"Valid initialized state?"}
  valid -->|Yes| retained["Keep persisted tasks, comments, and column order"]
  valid -->|No| source["Load and adapt mock data"]
  source --> seed["Seed normalized tasks and source comments"]
  retained --> runtime["Attach current sprint and known assignee IDs from source"]
  seed --> runtime
  runtime --> render["Render board / derived consumers"]
  render --> action{"Create, edit, comment, delete, or drag"}
  action --> validate["Validate IDs, fields, and destination"]
  validate -->|Invalid| unchanged["Return typed error; no partial mutation"]
  validate -->|Valid| atomic["Atomic store update"]
  atomic --> persist["Persist versioned domain state"]
  atomic --> selectors["Recompute dashboard and analytics selectors"]
```

`columnTaskIds` is the sole ordering authority after hydration. Moving into Done creates `completedAt` if needed; moving out clears it. Deleting a task also removes its column reference and comments.

## Notification lifecycle

```mermaid
flowchart TD
  auth["Authenticated shell"] --> seed["Initialize four mock notifications once"]
  seed --> visible{"Document visible?"}
  visible -->|No| pause["Polling disabled"]
  pause --> event["visibilitychange"]
  event --> visible
  visible -->|Yes| fetch["GET five JSONPlaceholder posts"]
  fetch -->|Network, HTTP, JSON, or shape error| warning["Keep existing items; show non-blocking retry UI"]
  fetch -->|Valid| map["Map post IDs to stable source IDs"]
  map --> dedupe["Deduplicate against persisted seen IDs"]
  dedupe --> merge["Sort newest first, cap history at 100, persist"]
  merge --> closed{"Panel closed and new items?"}
  closed -->|Yes| toast["Show informational toast"]
  closed -->|No| view["Update panel and unread badge"]
  toast --> view
  view --> timer["Refetch every 20 seconds"]
  timer --> visible
```

The visible panel pages 20 items at a time. Seen IDs retain bounded tombstones so an evicted notification is not immediately re-added by the static poll.

## Tradeoffs

- Browser storage makes the assignment self-contained but is not multi-user persistence or secure session storage.
- The source adapter rejects malformed data early instead of attempting partial rendering.
- Query retries are disabled. Authentication performs one explicit retry only after a coordinated refresh; user-facing data errors expose manual retry controls.
- Route splitting is preferred over blanket memoization. Analytics owns its larger chart dependency, while shared UI/store chunks remain cacheable.
