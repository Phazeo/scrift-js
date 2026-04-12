import { describe, expect, it } from 'vitest';

import {
  HttpClient,
  parseRateLimitHeaders,
  raiseForStatus,
} from '../src/http.js';
import {
  BATCH_JSON,
  createFetchStub,
  LIST_JSON,
  SEARCH_JSON,
  SERVICE_JSON,
} from './fixtures.js';

const TEST_KEY = 'scrf_testkey123456';

describe('parseRateLimitHeaders', () => {
  it('returns null when all three headers are absent', () => {
    expect(parseRateLimitHeaders(new Headers())).toBeNull();
  });

  it('returns object when only limit is present', () => {
    const h = new Headers({ 'X-RateLimit-Limit': '100' });
    expect(parseRateLimitHeaders(h)).toEqual({
      limit: 100,
      remaining: null,
      resetAt: null,
    });
  });

  it('returns object when only remaining is present', () => {
    const h = new Headers({ 'X-RateLimit-Remaining': '7' });
    expect(parseRateLimitHeaders(h)).toEqual({
      limit: null,
      remaining: 7,
      resetAt: null,
    });
  });

  it('returns object when only reset is present', () => {
    const h = new Headers({ 'X-RateLimit-Reset': '9999999999' });
    expect(parseRateLimitHeaders(h)).toEqual({
      limit: null,
      remaining: null,
      resetAt: 9999999999,
    });
  });

  it('treats empty string header values as null fields', () => {
    const h = new Headers({
      'X-RateLimit-Limit': '',
      'X-RateLimit-Remaining': '5',
    });
    expect(parseRateLimitHeaders(h)).toEqual({
      limit: null,
      remaining: 5,
      resetAt: null,
    });
  });
});

describe('attachRateLimit (via HttpClient.requestJson)', () => {
  function clientWithQueue(queue: Parameters<typeof createFetchStub>[0]) {
    const { fetch } = createFetchStub(queue);
    return new HttpClient({ apiKey: TEST_KEY, fetch });
  }

  it('merges rateLimit onto batch results and skips null and non-object values', async () => {
    const body = {
      ...BATCH_JSON,
      results: {
        ...BATCH_JSON.results,
        weird: [] as unknown,
        plain: 'skip',
      },
    };
    const http = clientWithQueue([
      {
        body,
        headers: {
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': '2',
          'X-RateLimit-Reset': '100',
        },
      },
    ]);
    const out = await http.requestJson<Record<string, unknown>>({
      path: '/v1/catalog/batch',
      method: 'POST',
      body: {},
    });
    expect(out.rateLimit?.limit).toBe(10);
    const res = out.results as Record<string, unknown>;
    expect(res['stripe']).toMatchObject({ rateLimit: out.rateLimit });
    expect(res['nonexistent']).toBeNull();
    expect(res['weird']).toEqual([]);
    expect(res['plain']).toBe('skip');
  });

  it('merges rateLimit onto list items and passes through null items', async () => {
    const body = {
      ...LIST_JSON,
      items: [SERVICE_JSON, null, { id: 3, slug: 'x' }],
    };
    const http = clientWithQueue([
      {
        body,
        headers: {
          'X-RateLimit-Limit': '50',
          'X-RateLimit-Remaining': '1',
          'X-RateLimit-Reset': '200',
        },
      },
    ]);
    const out = await http.requestJson<Record<string, unknown>>({
      path: '/v1/catalog',
    });
    const items = out.items as unknown[];
    expect(items[0]).toMatchObject({ rateLimit: out.rateLimit });
    expect(items[1]).toBeNull();
    expect(items[2]).toMatchObject({ slug: 'x', rateLimit: out.rateLimit });
  });

  it('merges rateLimit onto search matches and passes through null entries', async () => {
    const body = {
      ...SEARCH_JSON,
      matches: [SERVICE_JSON, null],
    };
    const http = clientWithQueue([
      {
        body,
        headers: {
          'X-RateLimit-Limit': '30',
          'X-RateLimit-Remaining': '3',
          'X-RateLimit-Reset': '300',
        },
      },
    ]);
    const out = await http.requestJson<Record<string, unknown>>({
      path: '/v1/search',
      query: { q: 'a' },
    });
    const matches = out.matches as unknown[];
    expect(matches[0]).toMatchObject({ rateLimit: out.rateLimit });
    expect(matches[1]).toBeNull();
  });

  it('returns JSON with rateLimit null when no rate-limit headers', async () => {
    const http = clientWithQueue([{ body: SERVICE_JSON }]);
    const out = await http.requestJson<Record<string, unknown>>({
      path: '/v1/catalog/stripe',
    });
    expect(out.rateLimit).toBeNull();
    expect(out.slug).toBe('stripe');
  });
});

describe('raiseForStatus', () => {
  it('uses status line when error body is not JSON', async () => {
    const response = new Response('not json', {
      status: 502,
      statusText: 'Bad Gateway',
      headers: { 'Content-Type': 'text/plain' },
    });
    await expect(raiseForStatus(response)).rejects.toMatchObject({
      message: 'HTTP 502 Bad Gateway',
    });
  });

  it('skips envelope parsing when JSON body is a non-object primitive', async () => {
    const response = new Response('5', {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
    await expect(raiseForStatus(response)).rejects.toMatchObject({
      errorCode: undefined,
      message: expect.stringMatching(/^HTTP 500\b/),
    });
  });

  it('ignores non-string error and message fields in JSON body', async () => {
    const response = new Response(
      JSON.stringify({ error: 404, message: ['nested'] }),
      {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      },
    );
    try {
      await raiseForStatus(response);
      expect.unreachable();
    } catch (err) {
      expect(err).toMatchObject({ errorCode: undefined });
      expect(err).toHaveProperty('message', expect.stringMatching(/^HTTP 422\b/));
    }
  });

  it('maps string error and message from JSON body', async () => {
    const response = new Response(
      JSON.stringify({ error: 'bad', message: 'Bad input' }),
      {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      },
    );
    await expect(raiseForStatus(response)).rejects.toMatchObject({
      errorCode: 'bad',
      message: 'Bad input',
    });
  });

  it('throws APIError for non-special 4xx status codes', async () => {
    const response = new Response(
      JSON.stringify({ error: 'nope', message: 'Forbidden' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      },
    );
    await expect(raiseForStatus(response)).rejects.toMatchObject({
      statusCode: 403,
      message: 'Forbidden',
    });
  });
});

describe('HttpClient constructor', () => {
  it('throws when fetch option is not a function', () => {
    expect(
      () =>
        new HttpClient({
          apiKey: TEST_KEY,
          fetch: true as unknown as typeof fetch,
        }),
    ).toThrow();
  });

  it('uses global fetch when the fetch option is omitted', () => {
    const http = new HttpClient({ apiKey: TEST_KEY });
    expect(http).toBeDefined();
  });
});

describe('retryAfterSecondsFromHeader (via final HTTP 429)', () => {
  function clientWithQueue(queue: Parameters<typeof createFetchStub>[0]) {
    const { fetch } = createFetchStub(queue);
    return new HttpClient({ apiKey: TEST_KEY, fetch });
  }

  const rateBody = { error: 'rate_limit_exceeded', message: 'Slow down' };

  it('uses null retryAfter when Retry-After header is absent on final 429', async () => {
    const http = clientWithQueue([
      { status: 429, body: rateBody, headers: { 'Retry-After': '0' } },
      { status: 429, body: rateBody },
    ]);
    await expect(http.requestJson({ path: '/v1/catalog/x' })).rejects.toMatchObject({
      retryAfter: null,
    });
  });

  it('floors fractional seconds in Retry-After', async () => {
    const http = clientWithQueue([
      { status: 429, body: rateBody, headers: { 'Retry-After': '0' } },
      {
        status: 429,
        body: rateBody,
        headers: { 'Retry-After': '7.8' },
      },
    ]);
    await expect(http.requestJson({ path: '/v1/catalog/x' })).rejects.toMatchObject({
      retryAfter: 7,
    });
  });

  it('returns null retryAfter when Retry-After is not a number or HTTP-date', async () => {
    const http = clientWithQueue([
      { status: 429, body: rateBody, headers: { 'Retry-After': '0' } },
      {
        status: 429,
        body: rateBody,
        headers: { 'Retry-After': 'not-a-number-or-date' },
      },
    ]);
    await expect(http.requestJson({ path: '/v1/catalog/x' })).rejects.toMatchObject({
      retryAfter: null,
    });
  });

  it('uses zero retryAfter for Retry-After: 0 on final 429', async () => {
    const http = clientWithQueue([
      { status: 429, body: rateBody, headers: { 'Retry-After': '0' } },
      {
        status: 429,
        body: rateBody,
        headers: { 'Retry-After': '0' },
      },
    ]);
    await expect(http.requestJson({ path: '/v1/catalog/x' })).rejects.toMatchObject({
      retryAfter: 0,
    });
  });
});
