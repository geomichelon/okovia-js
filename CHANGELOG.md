# Changelog

## 0.3.0 — 2026-07-24

- **CommonJS support**: `require("okovia")` now works. The package ships a
  dual build (`dist/` ESM, `dist/cjs/` CJS) with per-condition types, so
  Jest, `ts-node`, and CJS backends resolve it natively.
- **CDN build included**: `https://unpkg.com/okovia` /
  `https://cdn.jsdelivr.net/npm/okovia` now serve the OkOvia Tag
  (`dist/okovia.tag.js`) — the same auto-init loader hosted at
  `okovia.com/js/okovia.js`. Add `data-key` to the script tag.
- **Working source maps**: `src/` is now published, so `.js.map` /
  `.d.ts.map` resolve and go-to-definition lands in real TypeScript.
- `okovia/package.json` is exported (tooling can read the version again).
- Packaging smoke test (`npm run test:pack`) runs in the release
  workflow: packs the tarball, installs it clean, and consumes every
  surface (ESM import, CJS require, CLI, maps) before publishing.

## 0.2.0 — 2026-07-23

- New CLI: `npx okovia` (what's in the package + quickstart),
  `npx okovia doctor` (API connectivity check), `npx okovia --version`.
  Node stdlib only — the package still has zero runtime dependencies.

## 0.1.0 — 2026-07-20

- First public release: `OkoviaClient` (browser telemetry with batching,
  automatic flush, and retries), `createEventId`, `sanitizeProperties`.
  `VikingClient` stays exported as a back-compat alias.
