/**
 * Type definitions for the Scrift API.
 *
 * All shapes mirror the REST API response format exactly (camelCase field
 * names preserved). The SDK does not reshape payloads — the response you get
 * back from each method is a direct, typed view of the JSON returned by
 * api.scrift.app.
 */

/**
 * Valid SVG variants accepted by the `/v1/svg/{slug}` endpoint.
 */
export type SvgVariant =
  | 'mono'
  | 'color'
  | 'dark'
  | 'light'
  | 'wordmark'
  | 'icon';

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
  svgVariants: null;
  colors: null;
  _css: CssVars | null;
  _notice: string;
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
}

/**
 * Response shape for `GET /v1/search`.
 */
export interface SearchResponse {
  matches: ServiceResponse[];
  query: string;
  total: number;
}

/**
 * Response shape for `GET /v1/catalog` (paginated listing).
 */
export interface CatalogListResponse {
  items: ServiceResponse[];
  total: number;
  limit: number;
  offset: number;
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
  variant?: SvgVariant;
}
