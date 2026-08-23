# Local Lighthouse release evidence

This report records a local production-preview audit. It is not evidence for a deployed public origin.

## Result

| Field | Value |
|---|---|
| Date | 23 August 2026 |
| Route | `http://127.0.0.1:4173/login` |
| Build | Vite 8.2.2 production build served by `vite preview` |
| Lighthouse | 12.8.2, default mobile navigation profile |
| Performance | 99 |
| Accessibility | 100 |
| Best Practices | 100 |
| SEO | 100 |
| First Contentful Paint | 1.7 s |
| Largest Contentful Paint | 1.7 s |
| Total Blocking Time | 0 ms |
| Cumulative Layout Shift | 0 |

The audit reported no failed binary checks. Scores are environment-dependent and must be rerun against the deployed origin before submission.

## Reproduction

```bash
npm ci
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
npx --yes lighthouse@12.8.2 http://127.0.0.1:4173/login \
  --output=json \
  --output-path=/tmp/sprintdesk-lighthouse.json \
  --chrome-flags='--headless --no-sandbox --disable-gpu' \
  --quiet
```

Protected routes should also be measured through an authenticated clean browser session after deployment.
