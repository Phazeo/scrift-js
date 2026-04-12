import { describe, expect, it } from 'vitest';

import {
  APIError,
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  Scrift,
  ScriftClient,
  ScriftError,
  ScriftRateLimitError,
  ValidationError,
} from '../src/index.js';
import { parseRateLimitHeaders, parseRetryAfter } from '../src/http.js';
import {
  createFetchStub,
  ERROR_AUTH,
  ERROR_INTERNAL,
  ERROR_NOT_FOUND,
  ERROR_RATE_LIMIT,
  ERROR_VALIDATION,
  SERVICE_JSON,
} from './fixtures.js';

const TEST_KEY = 'scrf_testkey123456';

function makeClient(fetchStub: typeof fetch): ScriftClient {
  return new Scrift({ apiKey: TEST_KEY, fetch: fetchStub });
}

describe('error class hierarchy', () => {
  it('all subclasses inherit from ScriftError', () => {
    expect(new AuthenticationError('m')).toBeInstanceOf(ScriftError);
    expect(new NotFoundError('m')).toBeInstanceOf(ScriftError);
    expect(new ValidationError('m')).toBeInstanceOf(ScriftError);
    expect(new ScriftRateLimitError('m')).toBeInstanceOf(ScriftError);
    expect(new RateLimitError('m')).toBeInstanceOf(ScriftRateLimitError);
    expect(new APIError('m')).toBeInstanceOf(ScriftError);
  });

  it('ScriftError is an instance of Error', () => {
    expect(new ScriftError('m')).toBeInstanceOf(Error);
  });

  it('preserves message, status code, and error code', () => {
    const err = new APIError('boom', { statusCode: 500, errorCode: 'x' });
    expect(err.message).toBe('boom');
    expect(err.statusCode).toBe(500);
    expect(err.errorCode).toBe('x');
  });

  it('ScriftRateLimitError exposes retryAfter', () => {
    const err = new ScriftRateLimitError('slow down', { retryAfter: 7 });
    expect(err.retryAfter).toBe(7);
  });

  it('RateLimitError is an alias of ScriftRateLimitError', () => {
    expect(RateLimitError).toBe(ScriftRateLimitError);
  });
});

describe('error mapping by HTTP status', () => {
  it('401 → AuthenticationError', async () => {
    const { fetch } = createFetchStub([{ status: 401, body: ERROR_AUTH }]);
    const client = makeClient(fetch);
    await expect(client.catalog.get('stripe')).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });

  it('404 → NotFoundError', async () => {
    const { fetch } = createFetchStub([{ status: 404, body: ERROR_NOT_FOUND }]);
    const client = makeClient(fetch);
    await expect(client.catalog.get('nope')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('422 → ValidationError', async () => {
    const { fetch } = createFetchStub([{ status: 422, body: ERROR_VALIDATION }]);
    const client = makeClient(fetch);
    await expect(client.catalog.search('x')).rejects.toBeInstanceOf(ValidationError);
  });

  it('500 → APIError', async () => {
    const { fetch } = createFetchStub([{ status: 500, body: ERROR_INTERNAL }]);
    const client = makeClient(fetch);
    await expect(client.catalog.get('stripe')).rejects.toBeInstanceOf(APIError);
  });

  it('403 → APIError', async () => {
    const { fetch } = createFetchStub([
      { status: 403, body: { error: 'forbidden', message: 'Nope' } },
    ]);
    const client = makeClient(fetch);
    await expect(client.catalog.get('stripe')).rejects.toBeInstanceOf(APIError);
  });

  it('preserves statusCode, errorCode, and message on mapped errors', async () => {
    const { fetch } = createFetchStub([{ status: 401, body: ERROR_AUTH }]);
    const client = makeClient(fetch);
    try {
      await client.catalog.get('stripe');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AuthenticationError);
      if (err instanceof AuthenticationError) {
        expect(err.statusCode).toBe(401);
        expect(err.errorCode).toBe('invalid_api_key');
        expect(err.message).toBe('Invalid API key');
      }
    }
  });

  it('falls back to status-based message on non-JSON bodies', async () => {
    const { fetch } = createFetchStub([
      {
        status: 502,
        body: '<html>Bad Gateway</html>',
        raw: true,
        headers: { 'Content-Type': 'text/html' },
      },
    ]);
    const client = makeClient(fetch);
    try {
      await client.catalog.get('stripe');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(APIError);
      if (err instanceof APIError) {
        expect(err.statusCode).toBe(502);
        expect(err.message).toContain('502');
      }
    }
  });
});

describe('429 retry logic', () => {
  it('retries once on 429 and succeeds', async () => {
    const { fetch, calls } = createFetchStub([
      {
        status: 429,
        body: ERROR_RATE_LIMIT,
        headers: { 'Retry-After': '0' },
      },
      { body: SERVICE_JSON },
    ]);
    const client = makeClient(fetch);

    const result = await client.catalog.get('stripe');

    expect(result.slug).toBe('stripe');
    expect(calls).toHaveLength(2);
  });

  it('surfaces ScriftRateLimitError if retry also returns 429', async () => {
    const { fetch, calls } = createFetchStub([
      {
        status: 429,
        body: ERROR_RATE_LIMIT,
        headers: { 'Retry-After': '0' },
      },
      {
        status: 429,
        body: ERROR_RATE_LIMIT,
        headers: { 'Retry-After': '2' },
      },
    ]);
    const client = makeClient(fetch);

    try {
      await client.catalog.get('stripe');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ScriftRateLimitError);
      if (err instanceof ScriftRateLimitError) {
        expect(err.statusCode).toBe(429);
        expect(err.retryAfter).toBe(2);
      }
    }
    expect(calls).toHaveLength(2);
  });

  it('uses null retryAfter when Retry-After is unparseable on final 429', async () => {
    const { fetch } = createFetchStub([
      {
        status: 429,
        body: ERROR_RATE_LIMIT,
        headers: { 'Retry-After': '0' },
      },
      {
        status: 429,
        body: ERROR_RATE_LIMIT,
        headers: { 'Retry-After': 'not-a-number-or-date' },
      },
    ]);
    const client = makeClient(fetch);
    try {
      await client.catalog.get('stripe');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ScriftRateLimitError);
      if (err instanceof ScriftRateLimitError) {
        expect(err.retryAfter).toBeNull();
      }
    }
  });

  it('parses Retry-After HTTP-date on final 429', async () => {
    const future = new Date(Date.now() + 10_000).toUTCString();
    const { fetch } = createFetchStub([
      {
        status: 429,
        body: ERROR_RATE_LIMIT,
        headers: { 'Retry-After': '0' },
      },
      {
        status: 429,
        body: ERROR_RATE_LIMIT,
        headers: { 'Retry-After': future },
      },
    ]);
    const client = makeClient(fetch);
    try {
      await client.catalog.get('stripe');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ScriftRateLimitError);
      if (err instanceof ScriftRateLimitError) {
        expect(err.retryAfter).toBeGreaterThanOrEqual(9);
        expect(err.retryAfter).toBeLessThanOrEqual(10);
      }
    }
  });

  it('does not retry on other 4xx statuses', async () => {
    const { fetch, calls } = createFetchStub([
      { status: 404, body: ERROR_NOT_FOUND },
    ]);
    const client = makeClient(fetch);

    await expect(client.catalog.get('nope')).rejects.toBeInstanceOf(NotFoundError);
    expect(calls).toHaveLength(1);
  });
});

describe('parseRetryAfter', () => {
  it('parses numeric seconds', () => {
    expect(parseRetryAfter('5')).toBe(5000);
  });

  it('caps delay at 30 seconds', () => {
    expect(parseRetryAfter('9999')).toBe(30_000);
  });

  it('parses HTTP dates into a relative delay', () => {
    const future = new Date(Date.now() + 5_000).toUTCString();
    const parsed = parseRetryAfter(future);
    expect(parsed).toBeGreaterThan(4_000);
    expect(parsed).toBeLessThanOrEqual(5_000);
  });

  it('treats past HTTP dates as zero delay', () => {
    const past = new Date(Date.now() - 5_000).toUTCString();
    expect(parseRetryAfter(past)).toBe(0);
  });

  it('falls back to 1s on a missing header', () => {
    expect(parseRetryAfter(null)).toBe(1000);
  });

  it('falls back to 1s on garbage', () => {
    expect(parseRetryAfter('not-a-number')).toBe(1000);
  });
});

describe('parseRateLimitHeaders', () => {
  it('parses X-RateLimit-* headers', () => {
    const h = new Headers({
      'X-RateLimit-Limit': '100',
      'x-ratelimit-remaining': '9',
      'X-RateLimit-Reset': '1712592000',
    });
    expect(parseRateLimitHeaders(h)).toEqual({
      limit: 100,
      remaining: 9,
      resetAt: 1712592000,
    });
  });

  it('returns null when all absent', () => {
    expect(parseRateLimitHeaders(new Headers())).toBeNull();
  });

  it('treats non-numeric header values as null fields', () => {
    const h = new Headers({
      'X-RateLimit-Limit': 'not-a-number',
      'X-RateLimit-Remaining': '10',
    });
    expect(parseRateLimitHeaders(h)).toEqual({
      limit: null,
      remaining: 10,
      resetAt: null,
    });
  });
});

describe('client construction', () => {
  it('requires an API key', () => {
    // @ts-expect-error – deliberately missing the required field.
    expect(() => new Scrift({})).toThrow(TypeError);
  });

  it('rejects an empty API key', () => {
    expect(() => new Scrift({ apiKey: '' })).toThrow(TypeError);
  });

  it('rejects legacy sk credential prefixes', () => {
    const key = `${'sk'}_${'test'}_abc123456789`;
    expect(() => new Scrift({ apiKey: key })).toThrow(TypeError);
  });

  it('honors a custom baseUrl', async () => {
    const { fetch, calls } = createFetchStub([{ body: SERVICE_JSON }]);
    const client = new Scrift({
      apiKey: TEST_KEY,
      baseUrl: 'https://staging.scrift.test',
      fetch,
    });
    await client.catalog.get('stripe');
    expect(calls[0]?.url).toBe('https://staging.scrift.test/v1/catalog/stripe');
  });

  it('strips a trailing slash from baseUrl', async () => {
    const { fetch, calls } = createFetchStub([{ body: SERVICE_JSON }]);
    const client = new Scrift({
      apiKey: TEST_KEY,
      baseUrl: 'https://staging.scrift.test/',
      fetch,
    });
    await client.catalog.get('stripe');
    expect(calls[0]?.url).toBe('https://staging.scrift.test/v1/catalog/stripe');
  });
});

describe('network and timeout errors', () => {
  it('throws when fetch is not a function', () => {
    expect(
      () =>
        new Scrift({
          apiKey: TEST_KEY,
          fetch: true as unknown as typeof fetch,
        }),
    ).toThrow(ScriftError);
  });

  it('wraps non-Error throw values in APIError message', async () => {
    const throwingFetch: typeof fetch = async () => {
      throw 'string failure';
    };
    const client = new Scrift({ apiKey: TEST_KEY, fetch: throwingFetch });
    await expect(client.catalog.get('x')).rejects.toMatchObject({
      message: expect.stringContaining('string failure'),
    });
  });

  it('wraps fetch network failures in APIError', async () => {
    const failingFetch: typeof fetch = async () => {
      throw new TypeError('fetch failed');
    };
    const client = new Scrift({ apiKey: TEST_KEY, fetch: failingFetch });

    try {
      await client.catalog.get('stripe');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(APIError);
      if (err instanceof APIError) {
        expect(err.message).toContain('Network request');
      }
    }
  });

  it('wraps AbortError as a timeout APIError', async () => {
    const abortingFetch: typeof fetch = async () => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    };
    const client = new Scrift({
      apiKey: TEST_KEY,
      timeoutMs: 10,
      fetch: abortingFetch,
    });

    try {
      await client.catalog.get('stripe');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(APIError);
      if (err instanceof APIError) {
        expect(err.message).toContain('timed out');
      }
    }
  });
});
