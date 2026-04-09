/**
 * ScriftClient — the single public entry point for the SDK.
 *
 * Usage:
 *
 *     import { Scrift } from 'scrift-sdk';
 *
 *     const client = new Scrift({ apiKey: process.env.SCRIFT_API_KEY! });
 *     const stripe = await client.catalog.get('stripe');
 *
 * The client owns a single {@link HttpClient} instance and attaches each
 * resource as a public field. Resources are cheap, stateless wrappers — the
 * real work (auth, retries, timeouts, error mapping) happens in `http.ts`.
 *
 * Unlike the Python SDK, there is no `close()` / context-manager story here
 * because `fetch` does not own a persistent connection pool that needs
 * teardown — the platform manages sockets for us.
 */

import { HttpClient } from './http.js';
import { BrandResource } from './resources/brand.js';
import { CatalogResource } from './resources/catalog.js';
import { SvgResource } from './resources/svg.js';
import type { ScriftOptions } from './types.js';

export class ScriftClient {
  public readonly catalog: CatalogResource;
  public readonly svg: SvgResource;
  public readonly brand: BrandResource;

  constructor(options: ScriftOptions) {
    const http = new HttpClient({
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      timeoutMs: options.timeoutMs,
      fetch: options.fetch,
    });
    this.catalog = new CatalogResource(http);
    this.svg = new SvgResource(http);
    this.brand = new BrandResource(http);
  }
}

/**
 * Short, ergonomic alias for {@link ScriftClient}. This is the name users
 * are expected to import in 99% of cases:
 *
 *     import { Scrift } from 'scrift-sdk';
 *     const client = new Scrift({ apiKey: '…' });
 */
export const Scrift = ScriftClient;
