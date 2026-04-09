/**
 * HTTP transport layer.
 *
 * This is the ONLY place in the SDK that speaks HTTP. Resources delegate to
 * `HttpClient.request{Json,Text}` and never touch `fetch`, headers, retries,
 * or error mapping themselves. The dependency direction is strict:
 *
 *     resources  ──►  http  ──►  errors
 *
 * Nothing upstream of `http.ts` imports it except `client.ts`, and nothing
 * downstream of it is imported by `http.ts` except `errors.ts` and `types.ts`.
 *
 * Design notes:
 *
 *  - Zero runtime dependencies. We use the platform's native `fetch`, which
 *    is available in Node 18+, all modern browsers, Deno, Bun, Cloudflare
 *    Workers, Vercel Edge, and every other runtime we care about.
 *  - Timeouts are implemented with `AbortController` rather than any
 *    runtime-specific option, so the same code path works everywhere.
 *  - Retries are extremely conservative: one attempt on 429 only, capped at
 *    30 seconds of backoff. All other 4xx responses fail fast — retrying a
 *    bad request will never make it a good one.
 *  - Error mapping lives in exactly one place (`raiseForStatus`). Resources
 *    NEVER catch errors, NEVER inspect response status, NEVER parse error
 *    bodies. If you find yourself wanting to do any of those in a resource,
 *    you're in the wrong layer — add the behavior to `http.ts` instead.
 */

import {
  APIError,
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  ScriftError,
  ValidationError,
} from './errors.js';
import type { ApiErrorBody } from './types.js';
import { VERSION } from './version.js';

const DEFAULT_BASE_URL = 'https://api.scrift.app';
const DEFAULT_TIMEOUT_MS = 30_000;
const RETRY_AFTER_CAP_MS = 30_000;
const DEFAULT_RETRY_DELAY_MS = 1_000;

export interface HttpClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export interface RequestOptions {
  method?: 'GET' | 'POST';
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
}

/**
 * Sleep helper. Exposed as a module-level binding so tests can stub it out
 * without having to monkey-patch `global.setTimeout`.
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class HttpClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpClientOptions) {
    if (!options.apiKey || typeof options.apiKey !== 'string') {
      throw new ScriftError('apiKey is required and must be a non-empty string');
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (typeof fetchImpl !== 'function') {
      throw new ScriftError(
        'A global `fetch` implementation was not found. Upgrade to Node 18+ ' +
          'or pass a `fetch` option to the Scrift constructor.',
      );
    }
    // Bind to preserve `this` when the global fetch comes from a context
    // that expects to be invoked as a method (e.g. some edge runtimes).
    this.fetchImpl = fetchImpl.bind(globalThis);
  }

  /**
   * Execute a request and parse the response body as JSON.
   */
  async requestJson<T>(options: RequestOptions): Promise<T> {
    const response = await this.send(options);
    return (await response.json()) as T;
  }

  /**
   * Execute a request and return the response body as a plain string.
   * Used by the SVG endpoint, which returns `image/svg+xml`.
   */
  async requestText(options: RequestOptions): Promise<string> {
    const response = await this.send(options);
    return await response.text();
  }

  // ---------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------

  private buildUrl(path: string, query?: RequestOptions['query']): string {
    const url = new URL(this.baseUrl + path);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined) continue;
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  private buildHeaders(hasBody: boolean): Headers {
    const headers = new Headers({
      'X-API-Key': this.apiKey,
      'User-Agent': `scrift-js/${VERSION}`,
      Accept: 'application/json, image/svg+xml;q=0.9, */*;q=0.1',
    });
    if (hasBody) {
      headers.set('Content-Type', 'application/json');
    }
    return headers;
  }

  private async send(options: RequestOptions): Promise<Response> {
    const method = options.method ?? 'GET';
    const url = this.buildUrl(options.path, options.query);
    const hasBody = options.body !== undefined;

    const init: RequestInit = {
      method,
      headers: this.buildHeaders(hasBody),
    };
    if (hasBody) {
      init.body = JSON.stringify(options.body);
    }

    // First attempt.
    let response = await this.fetchWithTimeout(url, init);

    // Retry exactly once on 429, respecting Retry-After.
    if (response.status === 429) {
      const delayMs = parseRetryAfter(response.headers.get('Retry-After'));
      await sleep(delayMs);
      response = await this.fetchWithTimeout(url, init);
    }

    if (!response.ok) {
      await raiseForStatus(response);
    }
    return response;
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(url, { ...init, signal: controller.signal });
    } catch (err) {
      // Distinguish our own timeout from other network failures.
      if (isAbortError(err)) {
        throw new APIError(`Request to ${url} timed out after ${this.timeoutMs}ms`);
      }
      throw new APIError(
        `Network request to ${url} failed: ${errorMessage(err)}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function isAbortError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === 'AbortError' || err.name === 'TimeoutError')
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Parse the `Retry-After` header into a delay in milliseconds.
 *
 * The header can be either a delta-seconds value (`"5"`) or an HTTP-date
 * (`"Wed, 21 Oct 2015 07:28:00 GMT"`). We handle both. Anything unparseable
 * falls back to a 1-second delay. All values are capped at 30 seconds so a
 * misbehaving server can't stall the SDK indefinitely.
 */
export function parseRetryAfter(header: string | null): number {
  if (!header) return DEFAULT_RETRY_DELAY_MS;

  // Numeric delta-seconds form.
  const asNumber = Number(header);
  if (Number.isFinite(asNumber) && asNumber >= 0) {
    return Math.min(asNumber * 1000, RETRY_AFTER_CAP_MS);
  }

  // HTTP-date form.
  const asDate = Date.parse(header);
  if (!Number.isNaN(asDate)) {
    const delta = asDate - Date.now();
    if (delta <= 0) return 0;
    return Math.min(delta, RETRY_AFTER_CAP_MS);
  }

  return DEFAULT_RETRY_DELAY_MS;
}

/**
 * Map an error response to the appropriate {@link ScriftError} subclass and
 * throw it. This is the single chokepoint for error mapping in the SDK.
 */
export async function raiseForStatus(response: Response): Promise<never> {
  const { status } = response;
  let errorCode: string | undefined;
  let message: string | undefined;

  // Try to pull `{ error, message }` out of the body; tolerate any body
  // shape (including non-JSON) because upstream proxies can return HTML.
  try {
    const body = (await response.clone().json()) as Partial<ApiErrorBody>;
    if (body && typeof body === 'object') {
      if (typeof body.error === 'string') errorCode = body.error;
      if (typeof body.message === 'string') message = body.message;
    }
  } catch {
    // Non-JSON body. Fall back to a status-based message below.
  }

  const finalMessage = message ?? `HTTP ${status} ${response.statusText}`.trim();
  const init = { statusCode: status, errorCode };

  switch (status) {
    case 401:
      throw new AuthenticationError(finalMessage, init);
    case 404:
      throw new NotFoundError(finalMessage, init);
    case 422:
      throw new ValidationError(finalMessage, init);
    case 429: {
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfterSeconds = retryAfterHeader
        ? parseRetryAfter(retryAfterHeader) / 1000
        : undefined;
      throw new RateLimitError(finalMessage, {
        ...init,
        retryAfter: retryAfterSeconds,
      });
    }
    default:
      throw new APIError(finalMessage, init);
  }
}
