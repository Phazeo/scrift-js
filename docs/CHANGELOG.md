# Changelog

All notable changes to `scrift-sdk` are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-04-12

### Added

- `client.raster.getPng()` and `client.raster.getWebp()` for PNG/WebP raster
  endpoints (returns `ArrayBuffer`).
- `RateLimitInfo` on all JSON response types (`rateLimit` field), parsed from
  `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`; nested
  catalog items inherit the parent response rate limit.
- `ScriftRateLimitError` with `retryAfter: number | null` (final HTTP 429 after
  the single automatic retry). `RateLimitError` remains a backward-compatible
  alias.
- `SvgVariant` and `ServiceColor` typed interfaces on `ServiceResponse`.
- Client-side validation on `catalog.batch()`, `catalog.list()`, and raster
  methods (`TypeError` with clear messages).
- ADR-0001 documenting the single 429 retry decision.
- GitHub Actions workflow `.github/workflows/publish.yml` for tag-based npm
  publishes (uses `NPM_TOKEN` secret).

### Changed

- Consistent exports from `src/index.ts` (resources, models, errors).
- Raised `vitest` coverage thresholds (lines/statements/functions ≥97%,
  branches ≥95%).

### Removed

- Legacy `sk_*`-style API key prefixes (explicitly rejected; use `scrf_*` or
  opaque legacy keys per current API).

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
  `CatalogListResponse`, `CssVars`, `SvgVariantOption`).
- Error hierarchy rooted at `ScriftError`, with subclasses:
  `AuthenticationError` (401), `NotFoundError` (404),
  `ValidationError` (422), `RateLimitError` / `ScriftRateLimitError` (429),
  `APIError` (other).
- `RateLimitError.retryAfter` / `ScriftRateLimitError.retryAfter` exposing the
  parsed `Retry-After` header.
- Automatic retry on HTTP 429 — exactly once, honoring `Retry-After`
  (both delta-seconds and HTTP-date forms), capped at 30 seconds.
- Per-request 30s timeout, implemented with `AbortController`.
- Zero runtime dependencies — ships as a single bundle with no
  `dependencies` block in `package.json`.
- Dual ESM + CJS builds with TypeScript declaration files.
- Works on Node.js 18+, browsers, Deno, Bun, Cloudflare Workers,
  Vercel Edge, and AWS Lambda.
