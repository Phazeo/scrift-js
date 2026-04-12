import { describe, expect, it } from 'vitest';

import { Scrift, ScriftClient, ValidationError } from '../src/index.js';
import {
  BATCH_JSON,
  createFetchStub,
  ERROR_VALIDATION,
  LIST_JSON,
  RATE_LIMIT_HEADERS,
  SEARCH_JSON,
  SERVICE_JSON,
} from './fixtures.js';

const TEST_KEY = 'scrf_testkey123456';

function makeClient(fetchStub: typeof fetch): ScriftClient {
  return new Scrift({ apiKey: TEST_KEY, fetch: fetchStub });
}

function jsonWithRateLimit(body: unknown) {
  return { body, headers: { ...RATE_LIMIT_HEADERS } };
}

describe('CatalogResource.get', () => {
  it('fetches and returns a single brand', async () => {
    const { fetch, calls } = createFetchStub([jsonWithRateLimit(SERVICE_JSON)]);
    const client = makeClient(fetch);

    const result = await client.catalog.get('stripe');

    expect(result.slug).toBe('stripe');
    expect(result.name).toBe('Stripe');
    expect(result.brandColor).toBe('635BFF');
    expect(result._css?.['--brand-color']).toBe('#635BFF');
    expect(result.rateLimit).not.toBeNull();
    expect(result.rateLimit?.limit).toBe(1000);
    expect(result.rateLimit?.remaining).toBe(42);
    expect(result.rateLimit?.resetAt).toBe(1712592000);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.scrift.app/v1/catalog/stripe');
    expect(calls[0]?.method).toBe('GET');
  });

  it('sends the X-API-Key header on every request', async () => {
    const { fetch, calls } = createFetchStub([jsonWithRateLimit(SERVICE_JSON)]);
    const client = makeClient(fetch);

    await client.catalog.get('stripe');

    expect(calls[0]?.headers['x-api-key']).toBe(TEST_KEY);
  });

  it('sends a User-Agent identifying the SDK', async () => {
    const { fetch, calls } = createFetchStub([jsonWithRateLimit(SERVICE_JSON)]);
    const client = makeClient(fetch);

    await client.catalog.get('stripe');

    expect(calls[0]?.headers['user-agent']).toMatch(/^scrift-sdk\/\d+\.\d+\.\d+$/);
  });

  it('URL-encodes slugs containing special characters', async () => {
    const { fetch, calls } = createFetchStub([jsonWithRateLimit(SERVICE_JSON)]);
    const client = makeClient(fetch);

    await client.catalog.get('foo bar/baz');

    expect(calls[0]?.url).toBe('https://api.scrift.app/v1/catalog/foo%20bar%2Fbaz');
  });
});

describe('CatalogResource.list', () => {
  it('lists without pagination params by default', async () => {
    const { fetch, calls } = createFetchStub([jsonWithRateLimit(LIST_JSON)]);
    const client = makeClient(fetch);

    const result = await client.catalog.list();

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.rateLimit).not.toBeNull();
    expect(result.items[0]?.rateLimit).toEqual(result.rateLimit);
    expect(calls[0]?.url).toBe('https://api.scrift.app/v1/catalog');
  });

  it('passes limit and offset as query params', async () => {
    const { fetch, calls } = createFetchStub([jsonWithRateLimit(LIST_JSON)]);
    const client = makeClient(fetch);

    await client.catalog.list({ limit: 10, offset: 20 });

    expect(calls[0]?.url).toBe('https://api.scrift.app/v1/catalog?limit=10&offset=20');
  });

  it('omits undefined params rather than sending "undefined"', async () => {
    const { fetch, calls } = createFetchStub([jsonWithRateLimit(LIST_JSON)]);
    const client = makeClient(fetch);

    await client.catalog.list({ limit: 5 });

    expect(calls[0]?.url).toBe('https://api.scrift.app/v1/catalog?limit=5');
  });

  it('rejects limit out of range', () => {
    const client = makeClient(async () => new Response());
    expect(() => {
      void client.catalog.list({ limit: 0 });
    }).toThrow(TypeError);
    expect(() => {
      void client.catalog.list({ limit: 201 });
    }).toThrow(TypeError);
  });

  it('rejects negative offset', () => {
    const client = makeClient(async () => new Response());
    expect(() => {
      void client.catalog.list({ offset: -1 });
    }).toThrow(TypeError);
  });
});

describe('CatalogResource.batch', () => {
  it('posts a JSON body with the slugs array', async () => {
    const { fetch, calls } = createFetchStub([jsonWithRateLimit(BATCH_JSON)]);
    const client = makeClient(fetch);

    const result = await client.catalog.batch(['stripe', 'nonexistent']);

    expect(result.found).toBe(1);
    expect(result.notFound).toEqual(['nonexistent']);
    expect(result.results['stripe']).not.toBeNull();
    expect(result.results['nonexistent']).toBeNull();
    expect(result.rateLimit).not.toBeNull();
    expect(result.results['stripe']?.rateLimit).toEqual(result.rateLimit);

    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.url).toBe('https://api.scrift.app/v1/catalog/batch');
    expect(calls[0]?.headers['content-type']).toBe('application/json');
    expect(JSON.parse(calls[0]?.body ?? '')).toEqual({
      slugs: ['stripe', 'nonexistent'],
    });
  });

  it('rejects empty slugs array', () => {
    const client = makeClient(async () => new Response());
    expect(() => {
      void client.catalog.batch([]);
    }).toThrow(TypeError);
  });

  it('rejects more than 50 slugs', () => {
    const client = makeClient(async () => new Response());
    const slugs = Array.from({ length: 51 }, (_, i) => `s${i}`);
    expect(() => {
      void client.catalog.batch(slugs);
    }).toThrow(TypeError);
  });

  it('rejects blank slug entries', () => {
    const client = makeClient(async () => new Response());
    expect(() => {
      void client.catalog.batch(['a', '']);
    }).toThrow(TypeError);
  });

  it('rejects non-array slugs', () => {
    const client = makeClient(async () => new Response());
    expect(() => {
      void client.catalog.batch(null as unknown as string[]);
    }).toThrow(TypeError);
  });
});

describe('CatalogResource.search', () => {
  it('passes the query as the `q` param', async () => {
    const { fetch, calls } = createFetchStub([jsonWithRateLimit(SEARCH_JSON)]);
    const client = makeClient(fetch);

    const result = await client.catalog.search('stripe');

    expect(result.query).toBe('stripe');
    expect(result.matches).toHaveLength(1);
    expect(result.rateLimit).not.toBeNull();
    expect(result.matches[0]?.rateLimit).toEqual(result.rateLimit);
    expect(calls[0]?.url).toBe('https://api.scrift.app/v1/search?q=stripe');
  });

  it('passes the limit when provided', async () => {
    const { fetch, calls } = createFetchStub([jsonWithRateLimit(SEARCH_JSON)]);
    const client = makeClient(fetch);

    await client.catalog.search('stripe', { limit: 5 });

    expect(calls[0]?.url).toBe('https://api.scrift.app/v1/search?q=stripe&limit=5');
  });

  it('surfaces 422 as ValidationError for too-short queries', async () => {
    const { fetch } = createFetchStub([
      { status: 422, body: ERROR_VALIDATION },
    ]);
    const client = makeClient(fetch);

    await expect(client.catalog.search('x')).rejects.toBeInstanceOf(ValidationError);
  });
});
