/**
 * Type definitions for the Scrift API.
 *
 * All shapes mirror the REST API response format exactly (camelCase field
 * names preserved). The SDK does not reshape payloads — the response you get
 * back from each method is a direct, typed view of the JSON returned by
 * api.scrift.app.
 *
 * JSON responses also include `rateLimit` parsed from `X-RateLimit-*` headers.
 */

/**
 * Rate limit quota from response headers `X-RateLimit-*`.
 */
export interface RateLimitInfo {
  limit: number | null;
  remaining: number | null;
  /** Unix timestamp (seconds). */
  resetAt: number | null;
}

/**
 * Valid SVG variant names accepted by the `/v1/svg/{slug}` endpoint.
 */
export type SvgVariantOption =
  | 'mono'
  | 'color'
  | 'dark'
  | 'light'
  | 'wordmark'
  | 'icon';

/**
 * SVG variant metadata returned on catalog service entries.
 */
export interface SvgVariant {
  variant: string;
  verified: boolean;
}

/**
 * Single color role for a service (e.g. primary, on-dark).
 */
export interface ServiceColor {
  role: string;
  hex: string;
  source: string;
}

/**
 * CSS custom properties returned by the API.
 *
 * The field keys are the literal CSS custom property names (including the
 * leading double-dash), so they can be spread directly into a style object.
 */
export interface CssVars {
  '--brand-color': string;
  '--brand-color-dark': string;
  '--brand-color-contrast': string;
}

/**
 * A single brand/service from the catalog.
 *
 * Returned by `/v1/catalog/{slug}`, `/v1/catalog` (list items),
 * `/v1/catalog/batch` (map values), and `/v1/search` (match items).
 *
 * Note: `brandColor` and `darkModeColor` are hex strings *without* a leading
 * `#`. The `_css` object exposes the same values *with* the leading `#`
 * ready to be dropped into CSS.
 */
export interface ServiceResponse {
  id: number;
  slug: string;
  name: string;
  brandColor: string | null;
  darkModeColor: string | null;
  svgVariants: SvgVariant[] | null;
  colors: ServiceColor[] | null;
  _css: CssVars | null;
  _notice: string;
  rateLimit: RateLimitInfo | null;
}

/**
 * A brand returned by the `/v1/brand?domain=…` lookup endpoint.
 *
 * Shape mirrors {@link ServiceResponse} but additionally includes the list of
 * available SVG variants for this brand.
 */
export interface BrandResponse {
  id: number;
  slug: string;
  name: string;
  brandColor: string | null;
  darkModeColor: string | null;
  variants: string[];
  _css: CssVars | null;
  _notice: string;
  rateLimit: RateLimitInfo | null;
}

/**
 * Response shape for `POST /v1/catalog/batch`.
 *
 * `results` is a map from the requested slug to either the service entry or
 * `null` if the slug was not found. `notFound` is a flat list of the slugs
 * that were missing, provided for convenience.
 */
export interface BatchResponse {
  results: Record<string, ServiceResponse | null>;
  found: number;
  notFound: string[];
  rateLimit: RateLimitInfo | null;
}

/**
 * Response shape for `GET /v1/search`.
 */
export interface SearchResponse {
  matches: ServiceResponse[];
  query: string;
  total: number;
  rateLimit: RateLimitInfo | null;
}

/**
 * Response shape for `GET /v1/catalog` (paginated listing).
 */
export interface CatalogListResponse {
  items: ServiceResponse[];
  total: number;
  limit: number;
  offset: number;
  rateLimit: RateLimitInfo | null;
}

/**
 * Error envelope returned by the API for any non-2xx response.
 */
export interface ApiErrorBody {
  error: string;
  message: string;
}

/**
 * Configuration options for {@link Scrift}.
 */
export interface ScriftOptions {
  /** API key sent as the `X-API-Key` header. Required. */
  apiKey: string;
  /** Override the base URL (defaults to `https://api.scrift.app`). */
  baseUrl?: string;
  /** Request timeout in milliseconds (defaults to 30000). */
  timeoutMs?: number;
  /**
   * Optional fetch override. Useful for tests, custom pooling, or running in
   * environments where the global `fetch` is not suitable.
   */
  fetch?: typeof fetch;
}

/**
 * Options for list/pagination endpoints.
 */
export interface ListOptions {
  /** Page size, 1..200 (enforced by the API). */
  limit?: number;
  /** Offset into the result set. */
  offset?: number;
}

/**
 * Options for `catalog.search`.
 */
export interface SearchOptions {
  /** Maximum results to return, 1..50 (enforced by the API). */
  limit?: number;
}

/**
 * Options for `svg.get`.
 */
export interface SvgOptions {
  /** Variant to request; omit for the default. */
  variant?: SvgVariantOption;
}

/** Allowed `size` values for raster image endpoints. */
export type RasterSize = 32 | 64 | 128 | 256 | 512;

export const RASTER_SIZES: ReadonlySet<RasterSize> = new Set([
  32, 64, 128, 256, 512,
]);

/**
 * Options for `raster.getPng` / `raster.getWebp`.
 */
export interface RasterOptions {
  size?: RasterSize;
  variant?: string;
}

// ---------------------------------------------------------------------------
// Client-side validation (throws TypeError)
// ---------------------------------------------------------------------------

/**
 * Validate `catalog.batch(slugs)` arguments before any HTTP call.
 */
export function assertValidBatchSlugs(slugs: string[]): void {
  if (!Array.isArray(slugs)) {
    throw new TypeError('slugs must be a non-empty array');
  }
  if (slugs.length === 0) {
    throw new TypeError('slugs must be a non-empty array');
  }
  if (slugs.length > 50) {
    throw new TypeError('slugs must contain at most 50 entries');
  }
  for (let i = 0; i < slugs.length; i++) {
    const s = slugs[i];
    if (typeof s !== 'string' || s.trim() === '') {
      throw new TypeError(`slugs[${i}] must be a non-empty string`);
    }
  }
}

/**
 * Validate `catalog.list({ limit, offset })` arguments before any HTTP call.
 */
export function assertValidListOptions(options: ListOptions): void {
  if (options.limit !== undefined) {
    if (
      !Number.isInteger(options.limit) ||
      options.limit < 1 ||
      options.limit > 200
    ) {
      throw new TypeError('limit must be an integer between 1 and 200');
    }
  }
  if (options.offset !== undefined) {
    if (!Number.isInteger(options.offset) || options.offset < 0) {
      throw new TypeError('offset must be a non-negative integer');
    }
  }
}

/**
 * Validate raster slug and optional size before any HTTP call.
 */
export function assertValidRasterArgs(
  slug: string,
  size: RasterSize | undefined,
): void {
  if (typeof slug !== 'string' || slug.trim() === '') {
    throw new TypeError('slug must be a non-empty string');
  }
  if (size !== undefined && !RASTER_SIZES.has(size)) {
    throw new TypeError(
      `size must be one of ${Array.from(RASTER_SIZES).join(', ')} when provided`,
    );
  }
}
