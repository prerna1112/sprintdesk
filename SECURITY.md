# Security notes

Audit date: 2026-08-22

## React Router v6 exception

This assignment mandates React Router v6. The lockfile currently resolves
`react-router` and `react-router-dom` to 6.30.6, for which `npm audit` reports
two moderate advisories. This is a documented constraint and mitigation, not a
claim that the underlying vulnerabilities are fixed.

SprintDesk is a client-rendered application and does not use React Router SSR,
hydration, or error-deserialization APIs. Never pass user-controlled data to
`hydrationData` if server rendering is introduced later.

All current `<Link>` and `<Navigate>` destinations are application constants.
Every future dynamic destination influenced by a URL, API response, browser
storage, or other user-controlled input must pass through
`safeInternalPath()` in `src/routing/safe-internal-path.ts` before being given
to React Router. The helper rejects external, protocol-relative, backslash,
control-character, encoded bypass, and malformed-encoding destinations.

Migration to React Router v7 is planned when the assignment constraint is
relaxed. Until then, the two moderate audit findings remain an explicit
security exception and should be re-evaluated whenever dependencies change.

## Supported local runtime

Vite 8 requires Node `^20.19.0 || >=22.12.0`. The repository's `.nvmrc` pins
Node 22.12.0 as its reproducible LTS-compatible local baseline.
