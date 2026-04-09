/**
 * SVG resource — wraps `GET /v1/svg/{slug}`.
 *
 * Unlike the JSON endpoints, the response body here is a raw SVG document
 * (content-type: `image/svg+xml`). We expose it as a string so callers can
 * inline it into HTML, serialize it back to disk, or parse it themselves —
 * whatever they need.
 */

import type { HttpClient } from '../http.js';
import type { SvgOptions } from '../types.js';

export class SvgResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Fetch the raw SVG document for a brand.
   *
   * @param slug           Brand slug (e.g. `"stripe"`).
   * @param options.variant Optional variant — one of `mono`, `color`, `dark`,
   *                        `light`, `wordmark`, `icon`. If omitted, the
   *                        server returns its default variant for the brand.
   * @returns              Raw SVG markup as a UTF-8 string.
   * @throws {NotFoundError} if the slug or variant does not exist.
   */
  get(slug: string, options: SvgOptions = {}): Promise<string> {
    return this.http.requestText({
      path: `/v1/svg/${encodeURIComponent(slug)}`,
      query: { variant: options.variant },
    });
  }
}
