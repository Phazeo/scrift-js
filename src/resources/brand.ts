/**
 * Brand resource — wraps `GET /v1/brand?domain=…`.
 *
 * Unlike catalog lookups (which key off a slug), this endpoint keys off a
 * website domain — so given `"stripe.com"` it will return Stripe's brand
 * entry. Useful when you only know the site a user is on, not the canonical
 * slug.
 */

import type { HttpClient } from '../http.js';
import type { BrandResponse } from '../types.js';

export class BrandResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Look up a brand by its website domain.
   *
   * @param domain Fully-qualified domain, e.g. `"stripe.com"`.
   * @throws {NotFoundError} if no brand matches the domain.
   */
  get(domain: string): Promise<BrandResponse> {
    return this.http.requestJson<BrandResponse>({
      path: '/v1/brand',
      query: { domain },
    });
  }
}
