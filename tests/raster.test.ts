import { describe, expect, it } from 'vitest';

import { NotFoundError, Scrift, ScriftClient } from '../src/index.js';
import { createFetchStub, ERROR_NOT_FOUND } from './fixtures.js';

const TEST_KEY = 'scrf_testkey123456';

function makeClient(fetchStub: typeof fetch): ScriftClient {
  return new Scrift({ apiKey: TEST_KEY, fetch: fetchStub });
}

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;

describe('RasterResource.getPng', () => {
  it('returns ArrayBuffer bytes', async () => {
    const { fetch, calls } = createFetchStub([
      {
        arrayBuffer: PNG_BYTES,
        headers: { 'Content-Type': 'image/png' },
      },
    ]);
    const client = makeClient(fetch);

    const buf = await client.raster.getPng('stripe');

    expect(buf).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(buf)).toEqual(new Uint8Array(PNG_BYTES));
    expect(calls[0]?.url).toContain('/v1/png/stripe');
    expect(calls[0]?.headers['accept']).toBe('image/png');
  });

  it('passes size and variant query params', async () => {
    const { fetch, calls } = createFetchStub([
      { arrayBuffer: PNG_BYTES, headers: { 'Content-Type': 'image/png' } },
    ]);
    const client = makeClient(fetch);

    await client.raster.getPng('stripe', { size: 128, variant: 'dark' });

    expect(calls[0]?.url).toBe(
      'https://api.scrift.app/v1/png/stripe?size=128&variant=dark',
    );
  });

  it('rejects empty slug', () => {
    const client = makeClient(async () => new Response());
    expect(() => {
      void client.raster.getPng('  ');
    }).toThrow(TypeError);
  });

  it('rejects invalid size', () => {
    const client = makeClient(async () => new Response());
    expect(() => {
      void (
        // @ts-expect-error — intentionally invalid size for runtime validation
        client.raster.getPng('stripe', { size: 100 })
      );
    }).toThrow(TypeError);
  });

  it('maps 404 to NotFoundError', async () => {
    const { fetch } = createFetchStub([{ status: 404, body: ERROR_NOT_FOUND }]);
    const client = makeClient(fetch);

    await expect(client.raster.getPng('nope')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('RasterResource.getWebp', () => {
  it('requests image/webp', async () => {
    const webp = new ArrayBuffer(4);
    const { fetch, calls } = createFetchStub([
      { arrayBuffer: webp, headers: { 'Content-Type': 'image/webp' } },
    ]);
    const client = makeClient(fetch);

    const buf = await client.raster.getWebp('stripe');

    expect(new Uint8Array(buf)).toEqual(new Uint8Array(webp));
    expect(calls[0]?.headers['accept']).toBe('image/webp');
    expect(calls[0]?.url).toContain('/v1/webp/stripe');
  });
});
