/**
 * Public entry point for `scrift-sdk`.
 *
 * Everything a user of this library can reach is re-exported from this
 * file. If it's not listed here, it's internal — do not rely on it.
 */

// Client
export { Scrift, ScriftClient } from './client.js';

// Resources (exported as types so users can annotate but not instantiate
// directly — resources should always be reached through a `Scrift` instance).
export { CatalogResource } from './resources/catalog.js';
export { SvgResource } from './resources/svg.js';
export { BrandResource } from './resources/brand.js';
export { RasterResource } from './resources/raster.js';

// Errors
export {
  APIError,
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  ScriftRateLimitError,
  ScriftError,
  ValidationError,
} from './errors.js';

// Types
export type {
  ApiErrorBody,
  BatchResponse,
  BrandResponse,
  CatalogListResponse,
  CssVars,
  ListOptions,
  RasterOptions,
  RasterSize,
  RateLimitInfo,
  ScriftOptions,
  SearchOptions,
  SearchResponse,
  ServiceColor,
  ServiceResponse,
  SvgOptions,
  SvgVariant,
  SvgVariantOption,
} from './types.js';

export { RASTER_SIZES } from './types.js';

export { VERSION } from './version.js';
