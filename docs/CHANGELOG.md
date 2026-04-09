# Changelog

All notable changes to `@scrift/sdk` are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-04-09

Initial release.

### Added

- `Scrift` / `ScriftClient` — main client class, constructed with
  `{ apiKey, baseUrl?, timeoutMs?, fetch? }`.
- `CatalogResource` with methods:
  - `get(slug)` — fetch a single brand
  - `list({ limit?, offset? })` — paginated listing
  - `batch(slugs)` — bulk lookup (up to 50 slugs)
  - `search(query, { limit? })` — name-based search
- `SvgResource` with `get(slug, { variant? })` returning raw SVG
  markup as a string.
- `BrandResource` with `get(domain)` for domain-to-brand resolution.
- Full TypeScript types for every response shape (`ServiceResponse`,
  `BrandResponse`, `BatchResponse`, `SearchResponse`,
  `CatalogListResponse`, `CssVars`, `SvgVariant`).
- Error hierarchy rooted at `ScriftError`, with subclasses:
  `AuthenticationError` (401), `NotFoundError` (404),
  `ValidationError` (422), `RateLimitError` (429), `APIError` (other).
- `RateLimitError.retryAfter` exposing the parsed `Retry-After` header.
- Automatic retry on HTTP 429 — exactly once, honoring `Retry-After`
  (both delta-seconds and HTTP-date forms), capped at 30 seconds.
- Per-request 30s timeout, implemented with `AbortController`.
- Zero runtime dependencies — ships as a single bundle with no
  `dependencies` block in `package.json`.
- Dual ESM + CJS builds with TypeScript declaration files.
- Works on Node.js 18+, browsers, Deno, Bun, Cloudflare Workers,
  Vercel Edge, and AWS Lambda.
