/**
 * Raster resource — `GET /v1/png/{slug}` and `GET /v1/webp/{slug}`.
 *
 * Returns raw image bytes as {@link ArrayBuffer} for use in browsers, Node,
 * and edge runtimes without Node-specific APIs.
 */

import type { HttpClient } from '../http.js';
import type { RasterOptions } from '../types.js';
import { assertValidRasterArgs } from '../types.js';

export class RasterResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Fetch a PNG raster for a brand.
   *
   * @param slug Brand slug (e.g. `"stripe"`).
   * @param options.size Optional square size in pixels (32, 64, 128, 256, 512).
   * @param options.variant Optional variant name.
   */
  getPng(slug: string, options: RasterOptions = {}): Promise<ArrayBuffer> {
    assertValidRasterArgs(slug, options.size);
    return this.http.requestArrayBuffer({
      path: `/v1/png/${encodeURIComponent(slug)}`,
      query: {
        size: options.size,
        variant: options.variant,
      },
      accept: 'image/png',
    });
  }

  /**
   * Fetch a WebP raster for a brand.
   *
   * @param slug Brand slug (e.g. `"stripe"`).
   * @param options.size Optional square size in pixels (32, 64, 128, 256, 512).
   * @param options.variant Optional variant name.
   */
  getWebp(
    slug: string,
    options: RasterOptions = {},
  ): Promise<ArrayBuffer> {
    assertValidRasterArgs(slug, options.size);
    return this.http.requestArrayBuffer({
      path: `/v1/webp/${encodeURIComponent(slug)}`,
      query: {
        size: options.size,
        variant: options.variant,
      },
      accept: 'image/webp',
    });
  }
}
