/**
 * Catalog resource — wraps `/v1/catalog*` and `/v1/search`.
 *
 * Thin pass-through layer: every method is a one-liner into `HttpClient`.
 * No validation, no retries, no error handling — those belong in `http.ts`.
 * If you need to add a new catalog endpoint, add a method here and (if the
 * response shape is new) a type to `types.ts`. That's it.
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
   * The API accepts up to 50 slugs per call. The SDK does not enforce this
   * client-side — the server will return a 422 {@link ValidationError} if
   * you exceed the limit.
   */
  batch(slugs: string[]): Promise<BatchResponse> {
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
