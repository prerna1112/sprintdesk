# Submission checklist and demo script

## Final release checklist

### Repository

- [ ] `npm ci` succeeds with Node 22.12.0 and npm.
- [ ] `npm run check` passes (lint, typecheck, test, build).
- [ ] `npm audit --audit-level=high` reports zero high/critical findings; the two moderate Router v6 findings match `SECURITY.md`.
- [ ] `shasum -a 256 public/mock-data.json` equals `1015e1bdc02d855b229122e164551b58a6993b9e3fbcf6568a185990d338157b`.
- [ ] `git status --short` contains no uncommitted release changes.
- [ ] No `.env`, credentials, tokens, generated `dist`, or unrelated files are committed.
- [ ] README links, credentials, features, limitations, measured assets, and docs match the final commit.

### Functional and responsive QA

- [ ] In a clean browser profile, `/dashboard`, `/board`, and `/analytics` redirect to `/login`.
- [ ] `emilys` / `emilyspass` signs in; a refresh restores the session; logout returns to login and prevents restoration.
- [ ] Create, edit, comment on, delete, reorder, and cross-column move a task.
- [ ] Keyboard drag-and-drop works and announces destinations; empty columns accept drops.
- [ ] Moving into/out of Done updates analytics without a reload.
- [ ] The four analytics sections show charts, tooltips, textual summaries, and useful empty states.
- [ ] Initial notifications seed, five live items merge once, repeated polls deduplicate, read state persists, and a poll failure leaves existing items intact.
- [ ] Light/dark/system themes survive reload without a flash of the wrong theme.
- [ ] Test 375px, tablet, and desktop widths; test 200% zoom and both themes.
- [ ] Complete a keyboard-only pass: skip link, navigation, forms, drag handles, overlays, notifications, and logout.
- [ ] Confirm visible focus, focus trapping/restoration, labels, announcements, contrast, reduced motion, avatar fallback, and no console errors.

### Deployment and public artifacts

- [x] Run Lighthouse 12.8.2 against the local production preview `/login` route: Performance 99, Accessibility 100, Best Practices 100, SEO 100 on 23 August 2026.
- [ ] Configure the intended public Git remote and publish the final release commit before replacing the README's pending repository entry.
- [ ] Verify the public repository URL and a clean clone in a signed-out/incognito context.
- [ ] Deploy through either `vercel.json` or `netlify.toml` with Node 22.12.0+.
- [ ] Verify direct navigation and browser refresh on `/login`, `/dashboard`, `/board`, and `/analytics`.
- [ ] Verify `/mock-data.json`, hashed assets, DummyJSON, JSONPlaceholder, and avatar requests on the deployed origin.
- [ ] Verify localStorage persistence and logout on the deployed origin.
- [ ] Repeat Lighthouse in an incognito/clean profile against the production deployment and authenticated routes.
- [ ] Meet the release gates: Performance >= 88 and Accessibility >= 92. Record URL, route, device mode, date, and tool version; do not average or invent values.
- [ ] Capture representative screenshots, or leave the README screenshot entry explicitly pending.
- [x] Record and visually verify the local demo video (`artifacts/SprintDesk-complete-project-screen-recording.mp4`, 98 seconds, 1280×720 H.264 screen recording).
- [ ] Publish the demo video and verify its public URL in a signed-out/incognito window.
- [ ] Replace the README's pending repository/live/demo entries only after publication, then verify every link in a signed-out/incognito window.

Suggested Lighthouse commands after deploying:

```bash
# Chrome DevTools: open the deployed route in an incognito window,
# choose Lighthouse > Navigation > Mobile > Performance + Accessibility.

# If Lighthouse is already available in the release environment, an anonymous
# CLI run can measure login. Measure protected routes from an authenticated
# incognito DevTools session so /dashboard does not redirect to /login.
lighthouse https://DEPLOYED_HOST/login \
  --only-categories=performance,accessibility \
  --output=html \
  --output-path=./lighthouse-login.html
```

Do not commit a report containing session tokens, private URLs, or other sensitive browser state.

## Five-minute demo script

1. **Set context (20 seconds).** Show the README. State that SprintDesk is a browser-only demonstration using a validated static dataset, DummyJSON auth, JSONPlaceholder polling, and localStorage persistence.
2. **Authenticate (35 seconds).** Open a protected URL directly to show the login redirect. Sign in as `emilys`, refresh once to show session restoration, and point out the memory-only access token versus persisted refresh-token simulation.
3. **Dashboard and shell (30 seconds).** Show the current sprint summary, status totals, upcoming work, responsive navigation, notification badge, and theme selector.
4. **Board workflow (100 seconds).** Create a task, open it, edit it, add a comment, move it with the pointer, then move/reorder it with the keyboard. Mention atomic normalized state and persisted column ordering. Delete a disposable task and show the confirmation.
5. **Analytics (50 seconds).** Open Analytics and explain that velocity/trend use supplied sprint history while status/priority reflect live board state. Move a task into or out of Done and show the visual and textual values update without reload.
6. **Notifications (45 seconds).** Open the panel, show mock plus polled items, mark one/all read, pagination behavior, and visibility-aware 20-second polling. Explain why the static endpoint naturally stops at nine items and how deduplication prevents repeats.
7. **Accessibility and responsive behavior (30 seconds).** Demonstrate the skip link, visible focus, dialog/drawer focus restoration, dark mode, a 375px viewport, reduced-motion behavior, and avatar initials fallback.
8. **Architecture and quality (30 seconds).** Show the architecture/API docs, route chunks, `npm run check`, audit exception, and mock checksum. End with the deployed Lighthouse measurements and public repository/deployment/video links.
