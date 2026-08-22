# Confirmed assumptions and decisions

These decisions resolve assignment ambiguity and describe the implemented behavior.

| Topic | Confirmed decision | Consequence |
|---|---|---|
| Current sprint | Choose the sprint with the lexicographically latest ISO `startDate` (Sprint 3 in the supplied data). | Dashboard summaries and newly created tasks use Sprint 3. |
| Board scope | Seed the first 30 source tasks across all sprints. | The board is intentionally not filtered to only the current sprint. |
| Board ordering | Use source array order only for initial column seeding; persisted `columnTaskIds` is authoritative afterward. | The source `order` field is not treated as globally unique. |
| Identifiers | Convert source numeric IDs to opaque strings; generate client IDs with `crypto.randomUUID()`. | Features do not depend on numeric sequencing. |
| Completion metadata | Entering Done sets `completedAt` when absent; leaving Done clears it. | Analytics follow the current board's internally consistent state. |
| Auth token ownership | Store access token, expiry, and user in memory; persist only the refresh token. | A reload restores through refresh + `/auth/me`; this remains a localStorage simulation, not production auth. |
| Token lifetime | Request a one-minute DummyJSON token lifetime. | Refresh/restoration behavior is easy to demonstrate. |
| Request interception | Use the shared fetch wrapper for Bearer attachment, single-flight refresh, and one replay. | No infinite refresh loop; non-replayable bodies fail safely. |
| Mock data | Treat `/mock-data.json` as immutable page-lifetime server state after strict runtime validation. | There is no background refresh or server-side mutation. |
| Board persistence | Keep tasks, order, and comments in a versioned localStorage record. | Edits are per-origin/per-browser and can be reset by clearing site data. |
| Analytics | Derive models from the current board plus supplied sprint history. | Charts respond immediately without duplicate chart state. |
| First notification poll | Treat JSONPlaceholder IDs 1–5 as unseen on a fresh profile. | Four mock items become nine total; eight are unread. |
| Notification polling | Poll every 20 seconds only while authenticated and visible; refetch upon return. | Background tabs do not keep polling. |
| Notification history | Retain at most 100 items, page by 20, and retain a bounded seen-ID tombstone set. | Static IDs do not reappear after history eviction. |
| Error retries | Disable general automatic query retries; provide manual retry UI. Authenticated fetch retries once only after refresh. | Failures are predictable and visible. |
| Responsive board | Preserve usable card width with horizontally scrollable 87vw snap columns below desktop. | A 375px viewport scrolls columns rather than compressing four columns. |
| Accessibility | Prefer native semantics, explicit labels, focus management, live regions, textual chart summaries, keyboard DnD, and reduced motion. | Core flows remain usable without pointer-only interaction or chart graphics. |
| Deployment | Support either Vercel or Netlify with provider-specific non-asset SPA fallback configuration. | Direct route loads resolve to `index.html`; static assets and mock JSON remain addressable. |
| Router advisories | Retain React Router v6 because it is an assignment requirement and document the two moderate findings. | Do not use the breaking force-upgrade; re-evaluate when v7 is allowed. |
| Lighthouse | Treat Performance >= 88 and Accessibility >= 92 as release gates, not current results. | Measure on the final deployed origin; no score is claimed before then. |

No secrets, private API keys, real billing data, server writes, multi-user synchronization, email delivery, or push-notification infrastructure are assumed.
