import { describe, expect, it } from 'vitest';

import { Scrift, ValidationError } from '../src/index.js';
import {
  BATCH_JSON,
  createFetchStub,
  ERROR_VALIDATION,
  LIST_JSON,
  SEARCH_JSON,
  SERVICE_JSON,
} from './fixtures.js';

function makeClient(fetchStub: typeof fetch): Scrift {
  return new Scrift({ apiKey: 'sk_test_abc123', fetch: fetchStub });
}

describe('CatalogResource.get', () => {
  it('fetches and returns a single brand', async () => {
    const { fetch, calls } = createFetchStub([{ body: SERVICE_JSON }]);
    const client = makeClient(fetch);

    const result = await client.catalog.get('stripe');

    expect(result.slug).toBe('stripe');
    expect(result.name).toBe('Stripe');
    expect(result.brandColor).toBe('635BFF');
    expect(result._css?.['--brand-color']).toBe('#635BFF');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.scrift.app/v1/catalog/stripe');
    expect(calls[0]?.method).toBe('GET');
  });

  it('sends the X-API-Key header on every request', async () => {
    const { fetch, calls } = createFetchStub([{ body: SERVICE_JSON }]);
    const client = makeClient(fetch);

    await client.catalog.get('stripe');

    expect(calls[0]?.headers['x-api-key']).toBe('sk_test_abc123');
  });

  it('sends a User-Agent identifying the SDK', async () => {
    const { fetch, calls } = createFetchStub([{ body: SERVICE_JSON }]);
    const client = makeClient(fetch);

    await client.catalog.get('stripe');

    expect(calls[0]?.headers['user-agent']).toMatch(/^scrift-sdk\/\d+\.\d+\.\d+$/);
  });

  it('URL-encodes slugs containing special characters', async () => {
    const { fetch, calls } = createFetchStub([{ body: SERVICE_JSON }]);
    const client = makeClient(fetch);

    await client.catalog.get('foo bar/baz');

    expect(calls[0]?.url).toBe('https://api.scrift.app/v1/catalog/foo%20bar%2Fbaz');
  });
});

describe('CatalogResource.list', () => {
  it('lists without pagination params by default', async () => {
    const { fetch, calls } = createFetchStub([{ body: LIST_JSON }]);
    const client = makeClient(fetch);

    const result = await client.catalog.list();

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(calls[0]?.url).toBe('https://api.scrift.app/v1/catalog');
  });

  it('passes limit and offset as query params', async () => {
    const { fetch, calls } = createFetchStub([{ body: LIST_JSON }]);
    const client = makeClient(fetch);

    await client.catalog.list({ limit: 10, offset: 20 });

    expect(calls[0]?.url).toBe('https://api.scrift.app/v1/catalog?limit=10&offset=20');
  });

  it('omits undefined params rather than sending "undefined"', async () => {
    const { fetch, calls } = createFetchStub([{ body: LIST_JSON }]);
    const client = makeClient(fetch);

    await client.catalog.list({ limit: 5 });

    expect(calls[0]?.url).toBe('https://api.scrift.app/v1/catalog?limit=5');
  });
});

describe('CatalogResource.batch', () => {
  it('posts a JSON body with the slugs array', async () => {
    const { fetch, calls } = createFetchStub([{ body: BATCH_JSON }]);
    const client = makeClient(fetch);

    const result = await client.catalog.batch(['stripe', 'nonexistent']);

    expect(result.found).toBe(1);
    expect(result.notFound).toEqual(['nonexistent']);
    expect(result.results['stripe']).not.toBeNull();
    expect(result.results['nonexistent']).toBeNull();

    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.url).toBe('https://api.scrift.app/v1/catalog/batch');
    expect(calls[0]?.headers['content-type']).toBe('application/json');
    expect(JSON.parse(calls[0]?.body ?? '')).toEqual({
      slugs: ['stripe', 'nonexistent'],
    });
  });
});

describe('CatalogResource.search', () => {
  it('passes the query as the `q` param', async () => {
    const { fetch, calls } = createFetchStub([{ body: SEARCH_JSON }]);
    const client = makeClient(fetch);

    const result = await client.catalog.search('stripe');

    expect(result.query).toBe('stripe');
    expect(result.matches).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.scrift.app/v1/search?q=stripe');
  });

  it('passes the limit when provided', async () => {
    const { fetch, calls } = createFetchStub([{ body: SEARCH_JSON }]);
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
