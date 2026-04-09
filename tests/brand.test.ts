import { describe, expect, it } from 'vitest';

import { NotFoundError, Scrift } from '../src/index.js';
import { BRAND_JSON, createFetchStub, ERROR_NOT_FOUND } from './fixtures.js';

function makeClient(fetchStub: typeof fetch): Scrift {
  return new Scrift({ apiKey: 'sk_test_abc123', fetch: fetchStub });
}

describe('BrandResource.get', () => {
  it('looks up a brand by domain', async () => {
    const { fetch, calls } = createFetchStub([{ body: BRAND_JSON }]);
    const client = makeClient(fetch);

    const result = await client.brand.get('stripe.com');

    expect(result.slug).toBe('stripe');
    expect(result.name).toBe('Stripe');
    expect(result.variants).toEqual(['color', 'mono', 'wordmark']);
    expect(result._css?.['--brand-color']).toBe('#635BFF');
    expect(calls[0]?.url).toBe('https://api.scrift.app/v1/brand?domain=stripe.com');
  });

  it('URL-encodes the domain param', async () => {
    const { fetch, calls } = createFetchStub([{ body: BRAND_JSON }]);
    const client = makeClient(fetch);

    await client.brand.get('sub.example.com/path');

    // URLSearchParams encodes '/' as %2F
    expect(calls[0]?.url).toContain('domain=sub.example.com%2Fpath');
  });

  it('raises NotFoundError for an unknown domain', async () => {
    const { fetch } = createFetchStub([
      { status: 404, body: ERROR_NOT_FOUND },
    ]);
    const client = makeClient(fetch);

    await expect(client.brand.get('nobody.example')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
