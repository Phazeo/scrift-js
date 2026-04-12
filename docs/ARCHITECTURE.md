# SDK Architecture

## Overview

`scrift-sdk` is a thin, strongly-typed HTTP client for `api.scrift.app`.
It follows the same pattern as the Stripe, Anthropic, and OpenAI SDKs — a
public client class that owns a transport layer and exposes resources, each
of which is a flat collection of methods that delegate to the transport.

**Target runtimes:** Node.js 18+, browsers, Deno, Bun, Cloudflare Workers,
Vercel Edge, AWS Lambda. The SDK uses only web-standard `fetch` and
`AbortController`, so it has zero runtime dependencies.

## Layer structure

```
src/
├── index.ts             Public entry point (re-exports only)
├── client.ts            ScriftClient — attaches resources to one HttpClient
├── api-key.ts           API key format validation (constructor-time)
├── http.ts              HttpClient — auth, retry, timeout, error mapping
├── errors.ts            Error class hierarchy
├── types.ts             Types, models, and client-side validation helpers
├── version.ts           Version constant (baked into User-Agent)
└── resources/
    ├── catalog.ts       CatalogResource
    ├── svg.ts           SvgResource
    ├── brand.ts         BrandResource
    └── raster.ts        RasterResource (PNG/WebP bytes)
```

## Dependency direction

Dependencies point inward only. There is exactly one chokepoint for network
I/O and exactly one chokepoint for error mapping.

```
client.ts
   │
   └──► resources/*.ts
            │
            └──► http.ts ──► errors.ts
                       ├──► types.ts
                       ├──► api-key.ts
                       └──► version.ts
```

Concrete rules, enforced in review:

1. **`resources/` may only import from `http.ts` and `types.ts`.**
   Resources never `import from '../errors.js'`, never call `fetch`
   directly, never inspect `Response` objects, and never catch errors.
   If a resource file grows an `import` from anywhere else, something is
   wrong.

2. **`http.ts` may only import from `errors.ts`, `types.ts`, `version.ts`,
   and `api-key.ts`.** It is the single place that knows about auth headers,
   retries, timeouts, rate-limit header attachment on JSON bodies, and the
   shape of error responses.

3. **`errors.ts` imports nothing from the SDK.** Error classes are the
   innermost layer — they have no knowledge of HTTP, resources, or types.

4. **`types.ts` imports nothing.** It holds shared models and small
   client-side validation helpers used by resources.

5. **`index.ts` imports everything but implements nothing.** It is a
   barrel file whose sole purpose is to control the public API surface.

## HTTP layer contract

`HttpClient` exposes three methods to resources:

```ts
requestJson<T>(options: RequestOptions): Promise<T & { rateLimit: ... }>
requestText(options: RequestOptions): Promise<string>
requestArrayBuffer(options: RequestOptions): Promise<ArrayBuffer>
```

JSON responses include `rateLimit` parsed from `X-RateLimit-*` headers; nested
`ServiceResponse` entries in batch/list/search inherit the parent rate limit.

Resources never touch anything else on `HttpClient`. All of the following
behaviors are provided transparently:

- **Authentication.** The `X-API-Key` header is injected on every
  request from the `apiKey` passed to the constructor (validated via
  `api-key.ts`).
- **User-Agent.** `scrift-sdk/{VERSION}` is sent on every request.
- **Timeout.** Every request is bound to an `AbortController` with a
  default timeout of 30s (configurable via `timeoutMs`).
- **Retry.** Exactly one retry on HTTP 429, respecting the `Retry-After`
  header (both delta-seconds and HTTP-date forms), capped at 30 seconds.
  No other status is ever retried.
- **Error mapping.** Any non-2xx response is mapped to a subclass of
  `ScriftError` in `raiseForStatus`. This is the only place that throws
  HTTP errors in the SDK.

## How to add a new endpoint

1. **Wait for the backend to ship the route.** Do not speculate shapes.
2. Add any new response shapes to `src/types.ts`. Preserve the API's
   camelCase field names exactly — the SDK does not reshape payloads.
3. Open the appropriate resource file under `src/resources/` and add a
   method. It should be a one-liner that calls `this.http.requestJson`
   or `this.http.requestText` with the right path, query, and body.
4. Add tests in `tests/{resource}.test.ts` covering:
   - The happy path (correct URL, method, body, and return value).
   - Any relevant error (404, 422, etc.).
5. Update the method-reference table in `README.md`.

**Do NOT** add validation, retry logic, or error handling to the
resource. Those belong in `http.ts`, and changes there require much
more care. 99% of new endpoints should touch zero lines outside
`types.ts`, the resource file, and its test file.

## How to add a new resource

1. Create `src/resources/{name}.ts` with a class that takes an
   `HttpClient` in its constructor.
2. Register it in `src/client.ts`:
   ```ts
   this.{name} = new {Name}Resource(http);
   ```
3. Re-export the class from `src/index.ts`.
4. Create `tests/{name}.test.ts` with fresh tests.

## Never do this

- Do not add new runtime dependencies. Zero-dep is a load-bearing
  feature — it is what lets the SDK run on edge runtimes.
- Do not catch errors inside resources. If a resource is catching, it
  is almost certainly leaking transport concerns.
- Do not inspect `Response` objects outside `http.ts`.
- Do not break method signatures without a major version bump.
- Do not add retries to any status other than 429. Retrying 4xx masks
  bugs; retrying 5xx can amplify incidents.
- Do not reshape API responses into camelCase-shims. Callers are
  supposed to see the same field names the API docs advertise.

## Versioning

We follow [SemVer](https://semver.org/):

- **PATCH** — bug fixes with no API changes.
- **MINOR** — new methods or new optional parameters. Backward-compatible.
- **MAJOR** — any breaking change to a method signature, error class, or
  response type.

Never make breaking changes in patch or minor releases.
