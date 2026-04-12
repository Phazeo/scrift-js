/**
 * HTTP transport layer.
 *
 * This is the ONLY place in the SDK that speaks HTTP. Resources delegate to
 * `HttpClient.request{Json,Text,ArrayBuffer}` and never touch `fetch`, headers,
 * retries, or error mapping themselves. The dependency direction is strict:
 *
 *     resources  ──►  http  ──►  errors
 *
 * Nothing upstream of `http.ts` imports it except `client.ts`, and nothing
 * downstream of it is imported by `http.ts` except `errors.ts` and `types.ts`.
 */

import { validateApiKey } from './api-key.js';
import {
  APIError,
  AuthenticationError,
  NotFoundError,
  ScriftRateLimitError,
  ScriftError,
  ValidationError,
} from './errors.js';
import type { ApiErrorBody, RateLimitInfo } from './types.js';
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
  /** Override default `Accept` header for this request. */
  accept?: string;
}

/**
 * Sleep helper. Exposed as a module-level binding so tests can stub it out
 * without having to monkey-patch `global.setTimeout`.
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Parse `X-RateLimit-*` headers into {@link RateLimitInfo}.
 * Header names are matched case-insensitively via the Fetch `Headers` API.
 */
export function parseRateLimitHeaders(headers: Headers): RateLimitInfo | null {
  const limit = headerInt(headers, 'x-ratelimit-limit');
  const remaining = headerInt(headers, 'x-ratelimit-remaining');
  const resetAt = headerInt(headers, 'x-ratelimit-reset');
  if (limit === null && remaining === null && resetAt === null) return null;
  return { limit, remaining, resetAt };
}

function headerInt(headers: Headers, name: string): number | null {
  const raw = headers.get(name);
  if (raw === null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function attachRateLimit(
  data: Record<string, unknown>,
  rateLimit: RateLimitInfo | null,
): Record<string, unknown> & { rateLimit: RateLimitInfo | null } {
  const withTop = { ...data, rateLimit } as Record<string, unknown> & {
    rateLimit: RateLimitInfo | null;
  };

  if (rateLimit === null) {
    return withTop;
  }

  if ('results' in data && data.results && typeof data.results === 'object') {
    const results = { ...(data.results as Record<string, unknown>) };
    for (const key of Object.keys(results)) {
      const v = results[key];
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        results[key] = {
          ...(v as Record<string, unknown>),
          rateLimit,
        };
      }
    }
    return { ...withTop, results } as typeof withTop;
  }

  if ('items' in data && Array.isArray(data.items)) {
    return {
      ...withTop,
      items: (data.items as unknown[]).map((item) =>
        item !== null && typeof item === 'object'
          ? { ...(item as Record<string, unknown>), rateLimit }
          : item,
      ),
    } as typeof withTop;
  }

  if ('matches' in data && Array.isArray(data.matches)) {
    return {
      ...withTop,
      matches: (data.matches as unknown[]).map((item) =>
        item !== null && typeof item === 'object'
          ? { ...(item as Record<string, unknown>), rateLimit }
          : item,
      ),
    } as typeof withTop;
  }

  return withTop as Record<string, unknown> & {
    rateLimit: RateLimitInfo | null;
  };
}

export class HttpClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpClientOptions) {
    validateApiKey(options.apiKey);
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
    this.fetchImpl = fetchImpl.bind(globalThis);
  }

  /**
   * Execute a request and parse the response body as JSON.
   * Attaches {@link RateLimitInfo} from response headers to the returned object
   * (and nested service entries for batch/list/search).
   */
  async requestJson<T extends object>(
    options: RequestOptions,
  ): Promise<T & { rateLimit: RateLimitInfo | null }> {
    const response = await this.send(options);
    const data = (await response.json()) as T;
    const rateLimit = parseRateLimitHeaders(response.headers);
    return attachRateLimit(
      data as Record<string, unknown>,
      rateLimit,
    ) as T & { rateLimit: RateLimitInfo | null };
  }

  /**
   * Execute a request and return the response body as a plain string.
   * Used by the SVG endpoint, which returns `image/svg+xml`.
   */
  async requestText(options: RequestOptions): Promise<string> {
    const response = await this.send(options);
    return await response.text();
  }

  /**
   * Execute a request and return the raw response body bytes.
   * Used by PNG/WebP raster endpoints.
   */
  async requestArrayBuffer(options: RequestOptions): Promise<ArrayBuffer> {
    const response = await this.send(options);
    return await response.arrayBuffer();
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

  private buildHeaders(hasBody: boolean, accept?: string): Headers {
    const headers = new Headers({
      'X-API-Key': this.apiKey,
      'User-Agent': `scrift-sdk/${VERSION}`,
      Accept:
        accept ??
        'application/json, image/svg+xml;q=0.9, image/png;q=0.8, image/webp;q=0.8, */*;q=0.1',
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
      headers: this.buildHeaders(hasBody, options.accept),
    };
    if (hasBody) {
      init.body = JSON.stringify(options.body);
    }

    let response = await this.fetchWithTimeout(url, init);

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
      if (isAbortError(err)) {
        throw new APIError(`Request to ${url} timed out after ${this.timeoutMs}ms`);
      }
      throw new APIError(`Network request to ${url} failed: ${errorMessage(err)}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

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
 */
export function parseRetryAfter(header: string | null): number {
  if (!header) return DEFAULT_RETRY_DELAY_MS;

  const asNumber = Number(header);
  if (Number.isFinite(asNumber) && asNumber >= 0) {
    return Math.min(asNumber * 1000, RETRY_AFTER_CAP_MS);
  }

  const asDate = Date.parse(header);
  if (!Number.isNaN(asDate)) {
    const delta = asDate - Date.now();
    if (delta <= 0) return 0;
    return Math.min(delta, RETRY_AFTER_CAP_MS);
  }

  return DEFAULT_RETRY_DELAY_MS;
}

function retryAfterSecondsFromHeader(header: string | null): number | null {
  if (!header) return null;
  const trimmed = header.trim();
  const asNum = Number(trimmed);
  if (Number.isFinite(asNum) && asNum >= 0) {
    return Math.floor(asNum);
  }
  const asDate = Date.parse(trimmed);
  if (!Number.isNaN(asDate)) {
    return Math.max(0, Math.floor((asDate - Date.now()) / 1000));
  }
  return null;
}

export async function raiseForStatus(response: Response): Promise<never> {
  const { status } = response;
  let errorCode: string | undefined;
  let message: string | undefined;

  try {
    const body = (await response.clone().json()) as Partial<ApiErrorBody>;
    if (body && typeof body === 'object') {
      if (typeof body.error === 'string') errorCode = body.error;
      if (typeof body.message === 'string') message = body.message;
    }
  } catch {
    // Non-JSON body.
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
      const retryAfter = retryAfterSecondsFromHeader(
        response.headers.get('Retry-After'),
      );
      throw new ScriftRateLimitError(finalMessage, {
        ...init,
        retryAfter,
      });
    }
    default:
      throw new APIError(finalMessage, init);
  }
}
