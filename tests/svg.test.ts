import { describe, expect, it } from 'vitest';

import { NotFoundError, Scrift } from '../src/index.js';
import { createFetchStub, ERROR_NOT_FOUND, SVG_BODY } from './fixtures.js';

function makeClient(fetchStub: typeof fetch): Scrift {
  return new Scrift({ apiKey: 'sk_test_abc123', fetch: fetchStub });
}

describe('SvgResource.get', () => {
  it('returns the raw SVG body as a string', async () => {
    const { fetch, calls } = createFetchStub([
      {
        body: SVG_BODY,
        raw: true,
        headers: { 'Content-Type': 'image/svg+xml' },
      },
    ]);
    const client = makeClient(fetch);

    const svg = await client.svg.get('stripe');

    expect(typeof svg).toBe('string');
    expect(svg).toBe(SVG_BODY);
    expect(svg).toContain('<svg');
    expect(calls[0]?.url).toBe('https://api.scrift.app/v1/svg/stripe');
  });

  it('passes the variant as a query param', async () => {
    const { fetch, calls } = createFetchStub([
      {
        body: SVG_BODY,
        raw: true,
        headers: { 'Content-Type': 'image/svg+xml' },
      },
    ]);
    const client = makeClient(fetch);

    await client.svg.get('stripe', { variant: 'dark' });

    expect(calls[0]?.url).toBe('https://api.scrift.app/v1/svg/stripe?variant=dark');
  });

  it('raises NotFoundError when the slug is unknown', async () => {
    const { fetch } = createFetchStub([
      { status: 404, body: ERROR_NOT_FOUND },
    ]);
    const client = makeClient(fetch);

    await expect(client.svg.get('nonexistent')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('preserves error_code on NotFoundError', async () => {
    const { fetch } = createFetchStub([
      { status: 404, body: ERROR_NOT_FOUND },
    ]);
    const client = makeClient(fetch);

    try {
      await client.svg.get('nonexistent');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundError);
      if (err instanceof NotFoundError) {
        expect(err.statusCode).toBe(404);
        expect(err.errorCode).toBe('service_not_found');
        expect(err.message).toBe('Service not found');
      }
    }
  });
});
