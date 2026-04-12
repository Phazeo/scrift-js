/**
 * Shared fixtures for the test suite.
 *
 * Response payloads mirror real API responses we've captured from
 * api.scrift.app, including the camelCase field names and the `_css` /
 * `_notice` underscore-prefixed keys.
 *
 * JSON bodies omit `rateLimit` — the SDK attaches it from `X-RateLimit-*`
 * headers in `http.ts`, not from the JSON body.
 */

import type {
  BatchResponse,
  BrandResponse,
  CatalogListResponse,
  SearchResponse,
  ServiceResponse,
} from '../src/types.js';

/** Raw API JSON for a service (no `rateLimit` — comes from headers). */
type ServiceBody = Omit<ServiceResponse, 'rateLimit'>;

export const SERVICE_JSON: ServiceBody = {
  id: 1,
  slug: 'stripe',
  name: 'Stripe',
  brandColor: '635BFF',
  darkModeColor: '7A73FF',
  svgVariants: null,
  colors: null,
  _css: {
    '--brand-color': '#635BFF',
    '--brand-color-dark': '#7A73FF',
    '--brand-color-contrast': '#FFFFFF',
  },
  _notice: 'Provided by Scrift',
};

export const GITHUB_JSON: ServiceBody = {
  id: 2,
  slug: 'github',
  name: 'GitHub',
  brandColor: '181717',
  darkModeColor: 'FFFFFF',
  svgVariants: null,
  colors: null,
  _css: {
    '--brand-color': '#181717',
    '--brand-color-dark': '#FFFFFF',
    '--brand-color-contrast': '#FFFFFF',
  },
  _notice: 'Provided by Scrift',
};

type BrandBody = Omit<BrandResponse, 'rateLimit'>;

export const BRAND_JSON: BrandBody = {
  id: 1,
  slug: 'stripe',
  name: 'Stripe',
  brandColor: '635BFF',
  darkModeColor: '7A73FF',
  variants: ['color', 'mono', 'wordmark'],
  _css: {
    '--brand-color': '#635BFF',
    '--brand-color-dark': '#7A73FF',
    '--brand-color-contrast': '#FFFFFF',
  },
  _notice: 'Provided by Scrift',
};

type ListBody = Omit<CatalogListResponse, 'rateLimit'>;

export const LIST_JSON: ListBody = {
  items: [SERVICE_JSON, GITHUB_JSON],
  total: 2,
  limit: 10,
  offset: 0,
};

type BatchBody = Omit<BatchResponse, 'rateLimit'>;

export const BATCH_JSON: BatchBody = {
  results: {
    stripe: SERVICE_JSON,
    nonexistent: null,
  },
  found: 1,
  notFound: ['nonexistent'],
};

type SearchBody = Omit<SearchResponse, 'rateLimit'>;

export const SEARCH_JSON: SearchBody = {
  matches: [SERVICE_JSON],
  query: 'stripe',
  total: 1,
};

export const SVG_BODY =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>';

export const ERROR_NOT_FOUND = {
  error: 'service_not_found',
  message: 'Service not found',
};
export const ERROR_AUTH = {
  error: 'invalid_api_key',
  message: 'Invalid API key',
};
export const ERROR_RATE_LIMIT = {
  error: 'rate_limit_exceeded',
  message: 'Too many requests',
};
export const ERROR_VALIDATION = {
  error: 'query_too_short',
  message: 'Query must be at least 2 characters',
};
export const ERROR_INTERNAL = {
  error: 'internal_error',
  message: 'Something went wrong',
};

/** Standard rate-limit headers for mocks. */
export const RATE_LIMIT_HEADERS = {
  'X-RateLimit-Limit': '1000',
  'X-RateLimit-Remaining': '42',
  'X-RateLimit-Reset': '1712592000',
} as const;

// ---------------------------------------------------------------------------
// Mock fetch helpers
// ---------------------------------------------------------------------------

export interface MockResponseInit {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
  /** If set, returns `body` as a raw string rather than JSON.stringify-ing it. */
  raw?: boolean;
  /** Raw binary body (takes precedence over `body` / `raw`). */
  arrayBuffer?: ArrayBuffer;
}

/**
 * Build a `Response` object that looks like what `fetch` would return.
 *
 * We construct real `Response` instances rather than hand-rolled objects so
 * the SDK exercises the same code paths it would in production (including
 * `.json()`, `.text()`, `.clone()`, and header lookups).
 */
export function mockResponse(init: MockResponseInit = {}): Response {
  const status = init.status ?? 200;

  if (init.arrayBuffer !== undefined) {
    const headers = new Headers(init.headers ?? {});
    return new Response(init.arrayBuffer, {
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      headers,
    });
  }

  const isJson = !init.raw;
  const bodyText =
    init.body === undefined
      ? ''
      : isJson
        ? JSON.stringify(init.body)
        : String(init.body);

  const headers = new Headers(init.headers ?? {});
  if (isJson && init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return new Response(bodyText, {
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers,
  });
}

/**
 * Record of one invocation of the mock fetch, captured for assertions.
 */
export interface FetchCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
}

/**
 * Build a stubbed `fetch` that returns a queue of pre-canned responses.
 *
 * Each call pops the next `MockResponseInit` off the queue. If the queue
 * is exhausted, the stub throws — which surfaces "too many requests" bugs
 * immediately instead of letting them hide behind undefined behavior.
 */
export function createFetchStub(queue: MockResponseInit[]): {
  fetch: typeof fetch;
  calls: FetchCall[];
} {
  const calls: FetchCall[] = [];
  const remaining = [...queue];

  const stub: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : (input as URL).toString();
    const method = init?.method ?? 'GET';
    const headersObj: Record<string, string> = {};
    const rawHeaders = new Headers(init?.headers ?? {});
    rawHeaders.forEach((value, key) => {
      headersObj[key] = value;
    });
    const body = typeof init?.body === 'string' ? init.body : null;
    calls.push({ url, method, headers: headersObj, body });

    const next = remaining.shift();
    if (!next) {
      throw new Error(
        `createFetchStub: unexpected extra call to ${method} ${url} ` +
          '(queue exhausted)',
      );
    }
    return mockResponse(next);
  };

  return { fetch: stub, calls };
}
