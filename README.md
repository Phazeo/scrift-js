# scrift-sdk

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

The official TypeScript SDK for the [Scrift](https://scrift.app) brand asset
API. A thin, typed wrapper around `api.scrift.app` with zero runtime
dependencies that works in every modern JavaScript runtime — Node.js 18+,
browsers, Deno, Bun, Cloudflare Workers, Vercel Edge.

## Install

```bash
npm install scrift-sdk
```

Also available via `pnpm add scrift-sdk` and `yarn add scrift-sdk`.

## Quick start

```ts
import { Scrift } from 'scrift-sdk';

const client = new Scrift({ apiKey: process.env.SCRIFT_API_KEY! });

// Fetch a single brand by slug
const stripe = await client.catalog.get('stripe');
console.log(stripe.name, stripe._css?.['--brand-color']);

// Paginated list
const page = await client.catalog.list({ limit: 20, offset: 0 });
console.log(`${page.items.length} of ${page.total}`);

// Bulk lookup (up to 50 slugs)
const bulk = await client.catalog.batch(['stripe', 'github', 'vercel']);
console.log(`found=${bulk.found}, missing=${bulk.notFound.join(',')}`);

// Search by name
const matches = await client.catalog.search('stri', { limit: 5 });

// Resolve by website domain
const byDomain = await client.brand.get('stripe.com');
console.log(byDomain.variants); // e.g. ['color', 'mono', 'wordmark']

// Raw SVG markup (returned as a UTF-8 string)
const svg = await client.svg.get('stripe', { variant: 'dark' });
// Render the SVG safely — e.g. write it to disk, pass it to a sanitizer,
// or parse it with DOMParser before inserting into the DOM.
```

## Method reference

| Method                                    | Returns               | Endpoint                         |
| ----------------------------------------- | --------------------- | -------------------------------- |
| `client.catalog.get(slug)`                | `ServiceResponse`     | `GET /v1/catalog/{slug}`         |
| `client.catalog.list({limit, offset})`    | `CatalogListResponse` | `GET /v1/catalog`                |
| `client.catalog.batch(slugs)`             | `BatchResponse`       | `POST /v1/catalog/batch`         |
| `client.catalog.search(q, {limit})`       | `SearchResponse`      | `GET /v1/search?q={q}`           |
| `client.svg.get(slug, {variant})`         | `string` (SVG markup) | `GET /v1/svg/{slug}`             |
| `client.brand.get(domain)`                | `BrandResponse`       | `GET /v1/brand?domain={domain}`  |
| `client.raster.getPng(slug, {size, variant?})` | `ArrayBuffer`    | `GET /v1/png/{slug}`             |
| `client.raster.getWebp(slug, {size, variant?})` | `ArrayBuffer`   | `GET /v1/webp/{slug}`            |

### SVG variants

Valid values for the `variant` option on `svg.get`:

```ts
type SvgVariantOption = 'mono' | 'color' | 'dark' | 'light' | 'wordmark' | 'icon';
```

Omit the option to get the brand's default variant.

### Constructor options

```ts
new Scrift({
  apiKey: 'scrf_…',                   // required
  baseUrl: 'https://api.scrift.app',  // default
  timeoutMs: 30_000,                  // default (per-request)
  fetch: customFetch,                 // optional override
});
```

If you do not supply a `fetch` option, the SDK uses the platform's native
`fetch`. Pass your own implementation if you need custom pooling, logging,
or if you're on a runtime where the global `fetch` is absent.

## Error handling

Every error raised by the SDK is a subclass of `ScriftError`, so a single
`catch` is sufficient:

```ts
import {
  AuthenticationError,
  NotFoundError,
  ScriftError,
  ScriftRateLimitError,
  ValidationError,
} from 'scrift-sdk';

try {
  const brand = await client.catalog.get('nonexistent');
} catch (err) {
  if (err instanceof NotFoundError) {
    // 404 — brand does not exist
  } else if (err instanceof AuthenticationError) {
    // 401 — bad or missing API key
  } else if (err instanceof ScriftRateLimitError) {
    // 429 — includes err.retryAfter (seconds or null) from Retry-After
  } else if (err instanceof ValidationError) {
    // 422 — server rejected the request parameters
  } else if (err instanceof ScriftError) {
    // Everything else: 5xx, network failures, timeouts
    console.error(err.statusCode, err.errorCode, err.message);
  } else {
    throw err;
  }
}
```

| Class                 | HTTP Status | When                                             |
| --------------------- | ----------- | ------------------------------------------------ |
| `AuthenticationError` | 401         | Missing, malformed, or revoked API key           |
| `NotFoundError`       | 404         | Slug, domain, or variant does not exist          |
| `ValidationError`     | 422         | Request parameters failed server-side validation |
| `ScriftRateLimitError`| 429         | Rate limit exhausted (retried once automatically)|
| `APIError`            | other       | 5xx, network failures, timeouts                  |

Every error exposes:

- `message` — human-readable description
- `statusCode` — HTTP status (when available)
- `errorCode` — machine-readable code from the API (e.g. `"service_not_found"`)

`ScriftRateLimitError` additionally exposes `retryAfter` (`number | null`,
seconds) parsed from the `Retry-After` header. The `RateLimitError` name is a
backward-compatible alias for the same class.

### Automatic retry

The SDK retries **exactly once** on a 429 response, respecting the
`Retry-After` header and capping the backoff at 30 seconds. It never retries
other 4xx errors — those fail fast. If the retry also returns 429, a
`ScriftRateLimitError` is raised.

## Works everywhere

`scrift-sdk` uses only the Fetch API and `AbortController`, so it runs in:

- Node.js 18+ (18/20/22/24)
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Deno
- Bun
- Cloudflare Workers
- Vercel Edge Runtime
- AWS Lambda (Node 18+ runtime)

Zero runtime dependencies. The entire library ships as a single ~10 KB file.

## Links

- Homepage: [https://scrift.app](https://scrift.app)
- API docs: [https://scrift.app/docs](https://scrift.app/docs)
- Issues: [github.com/phazeo/scrift-js/issues](https://github.com/phazeo/scrift-js/issues)
- Python SDK: [github.com/phazeo/scrift-python](https://github.com/phazeo/scrift-python)

## License

MIT — see [LICENSE](./LICENSE).
