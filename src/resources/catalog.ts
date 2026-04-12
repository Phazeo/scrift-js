/**
 * Catalog resource — wraps `/v1/catalog*` and `/v1/search`.
 *
 * Thin pass-through layer: every method delegates to `HttpClient.requestJson`.
 * Client-side argument validation throws {@link TypeError} before any HTTP
 * call. Retries and error mapping live in `http.ts`.
 */

import type { HttpClient } from '../http.js';
import type {
  BatchResponse,
  CatalogListResponse,
  ListOptions,
  SearchOptions,
  SearchResponse,
  ServiceResponse,
} from '../types.js';
import { assertValidBatchSlugs, assertValidListOptions } from '../types.js';

export class CatalogResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Fetch a single brand by its slug.
   *
   * @throws {NotFoundError} if no brand exists with the given slug.
   */
  get(slug: string): Promise<ServiceResponse> {
    return this.http.requestJson<ServiceResponse>({
      path: `/v1/catalog/${encodeURIComponent(slug)}`,
    });
  }

  /**
   * List brands in the catalog, paginated.
   *
   * @param options.limit  Page size (1..200). Server-enforced.
   * @param options.offset Offset into the result set.
   */
  list(options: ListOptions = {}): Promise<CatalogListResponse> {
    assertValidListOptions(options);
    return this.http.requestJson<CatalogListResponse>({
      path: '/v1/catalog',
      query: {
        limit: options.limit,
        offset: options.offset,
      },
    });
  }

  /**
   * Look up multiple brands by slug in a single request.
   *
   * The API accepts up to 50 slugs per call; the SDK enforces this
   * client-side before sending.
   */
  batch(slugs: string[]): Promise<BatchResponse> {
    assertValidBatchSlugs(slugs);
    return this.http.requestJson<BatchResponse>({
      method: 'POST',
      path: '/v1/catalog/batch',
      body: { slugs },
    });
  }

  /**
   * Search the catalog by brand name.
   *
   * The query must be at least 2 characters (server-enforced). Shorter
   * queries will raise a {@link ValidationError}.
   */
  search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    return this.http.requestJson<SearchResponse>({
      path: '/v1/search',
      query: {
        q: query,
        limit: options.limit,
      },
    });
  }
}
