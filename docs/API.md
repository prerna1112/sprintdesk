# Consumed data and API contracts

SprintDesk has no application-owned backend and no Swagger/OpenAPI service. It consumes exactly one checked-in JSON file and two public demonstration APIs.

## Base URLs

| Source | Base URL / path | Configuration |
|---|---|---|
| DummyJSON auth | `https://dummyjson.com` | Optional `VITE_API_BASE_URL`; defaults to this URL. |
| JSONPlaceholder | `https://jsonplaceholder.typicode.com` | Fixed in the notification service. |
| Mock data | `/mock-data.json` | Same-origin static Vite/public asset. |

`VITE_API_BASE_URL` must expose compatible `/auth/login`, `/auth/refresh`, and `/auth/me` routes. It is public browser configuration, not a secret.

## DummyJSON authentication

Only the fields listed below are consumed; DummyJSON may return additional profile fields.

### Login

```http
POST /auth/login
Content-Type: application/json

{
  "username": "emilys",
  "password": "emilyspass",
  "expiresInMins": 1
}
```

Consumed success shape:

```json
{
  "id": 1,
  "username": "emilys",
  "email": "emily.johnson@x.dummyjson.com",
  "firstName": "Emily",
  "lastName": "Johnson",
  "image": "https://dummyjson.com/icon/emilys/128",
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>"
}
```

`id` may be a number or string. All shown string fields and both non-empty tokens are required by the parser. HTTP 400/401 is mapped to an invalid-credentials error; other non-2xx responses are server errors. Network, unreadable JSON, and invalid response shapes receive separate user-safe errors.

### Refresh

```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "<persisted refresh token>",
  "expiresInMins": 1
}
```

Consumed success shape:

```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>"
}
```

The JWT `exp` claim sets the in-memory refresh deadline. If it cannot be decoded, the client uses a one-minute fallback deadline. JWT decoding is timing metadata only and is not client-side signature verification.

### Current user

```http
GET /auth/me
Authorization: Bearer <access token>
```

Consumed success shape:

```json
{
  "id": 1,
  "username": "emilys",
  "email": "emily.johnson@x.dummyjson.com",
  "firstName": "Emily",
  "lastName": "Johnson",
  "image": "https://dummyjson.com/icon/emilys/128"
}
```

Session restoration refreshes first when only a refresh token is available, then validates the resulting access token with `/auth/me`. Any restoration failure clears the local session.

### Authenticated request retry policy

The shared authenticated fetch wrapper:

1. adds/replaces one `Authorization: Bearer ...` header;
2. refreshes before a request if the token is missing, has no expiry, or expires within five seconds;
3. coordinates simultaneous refresh callers through one in-flight refresh;
4. after a 401, refreshes if another caller has not already replaced the token, then retries the original replayable request once;
5. never loops, never retries streaming/consumed bodies, and clears the session after an unrecoverable refresh failure.

There is no general automatic retry for login, `/auth/me`, mock-data, or notification requests.

## Static mock data

```http
GET /mock-data.json
```

Expected root shape and source field names:

```ts
interface MockDataDTO {
  users: Array<{
    id: number; name: string; email: string; avatar: string;
  }>;
  sprints: Array<{
    id: number; name: string; startDate: string; endDate: string;
  }>;
  tasks: Array<{
    id: number;
    title: string;
    description: string;
    status: 'backlog' | 'in-progress' | 'review' | 'done';
    priority: 'low' | 'medium' | 'high';
    assigneeId: number;
    dueDate: string;
    sprintId: number;
    order: number;
    createdAt: string;
    completedAt: string | null;
    updatedAt: string;
  }>;
  comments: Array<{
    id: number; taskId: number; authorId: number; message: string; createdAt: string;
  }>;
  notifications: Array<{
    id: number;
    title: string;
    message: string;
    type: 'task' | 'review';
    read: boolean;
    createdAt: string;
  }>;
}
```

The checked-in response has 6 users, 3 sprints, 30 tasks, 5 comments, and 4 notifications. It is validated for supported values, ISO dates, unique IDs, and cross-collection references. The adapter consumes the first 30 tasks, converts IDs to strings, maps `in-progress` to `inProgress`, and maps source fields to domain names (`avatarUrl`, `body`, `readAt`). An HTTP error, invalid JSON, or invalid schema fails the query and produces route-level/manual retry UI. The successful query is considered immutable (`staleTime: Infinity`) for the page lifetime and is not automatically retried.

## JSONPlaceholder notification polling

```http
GET /posts?_limit=5 HTTP/1.1
Host: jsonplaceholder.typicode.com
Accept: application/json
```

Expected response:

```json
[
  {
    "userId": 1,
    "id": 1,
    "title": "sunt aut facere repellat provident occaecati excepturi optio reprehenderit",
    "body": "quia et suscipit ..."
  }
]
```

The payload must be an array of at most five items. `userId` and positive `id` must be integers; trimmed `title` and `body` must be non-empty strings. Each item maps to a stable `jsonPlaceholder:<id>` notification ID and gets the poll receipt time as `createdAt`.

Polling behavior:

- begins only after authentication, notification-store hydration, and the one-time mock notification seed;
- runs immediately and then every 20,000 ms while the document is visible;
- pauses while hidden and refetches when visibility returns;
- disables TanStack Query automatic retries;
- reports network, non-2xx, invalid JSON, and invalid-shape failures without discarding persisted notifications;
- exposes a manual **Retry updates** action;
- deduplicates repeated IDs against a bounded persisted seen-ID set.

Because the endpoint always returns IDs 1–5, later successful polls do not add more items. A fresh browser profile therefore naturally contains nine notifications after the first poll, not enough to naturally display the 20-item pagination boundary.
