/**
 * Error hierarchy raised by the Scrift SDK.
 *
 * Every error raised by the SDK is an instance of {@link ScriftError}, so a
 * single `catch (err) { if (err instanceof ScriftError) … }` is sufficient to
 * catch everything the SDK might throw. Callers who want to react to specific
 * failure modes can narrow to one of the subclasses below.
 */

export interface ScriftErrorInit {
  statusCode?: number;
  errorCode?: string;
}

/**
 * Base class for all Scrift SDK errors.
 *
 * Exposes the HTTP status code and the machine-readable error code (from the
 * API's `{ error, message }` envelope) when available.
 */
export class ScriftError extends Error {
  public readonly statusCode: number | undefined;
  public readonly errorCode: string | undefined;

  constructor(message: string, init: ScriftErrorInit = {}) {
    super(message);
    this.name = 'ScriftError';
    this.statusCode = init.statusCode;
    this.errorCode = init.errorCode;
    // Preserve prototype chain for `instanceof` checks when targeting older
    // runtimes that downlevel class inheritance.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Raised on HTTP 401 — missing, malformed, or revoked API key. */
export class AuthenticationError extends ScriftError {
  constructor(message: string, init: ScriftErrorInit = {}) {
    super(message, init);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Raised on HTTP 404 — the requested resource does not exist. */
export class NotFoundError extends ScriftError {
  constructor(message: string, init: ScriftErrorInit = {}) {
    super(message, init);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface RateLimitErrorInit extends ScriftErrorInit {
  /** Seconds to wait before retrying, parsed from the `Retry-After` header. */
  retryAfter?: number;
}

/**
 * Raised on HTTP 429 — the rate limit for the current API key has been
 * exhausted.
 *
 * The SDK automatically retries 429s once (respecting the `Retry-After`
 * header, capped at 30 seconds) before surfacing this error, so seeing it
 * means even the retry attempt was rate-limited.
 */
export class RateLimitError extends ScriftError {
  public readonly retryAfter: number | undefined;

  constructor(message: string, init: RateLimitErrorInit = {}) {
    super(message, init);
    this.name = 'RateLimitError';
    this.retryAfter = init.retryAfter;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Raised on HTTP 422 — request parameters failed server-side validation. */
export class ValidationError extends ScriftError {
  constructor(message: string, init: ScriftErrorInit = {}) {
    super(message, init);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Raised on any other non-success status code (5xx, unexpected 4xx, network
 * failures that surface through `fetch`, etc.).
 */
export class APIError extends ScriftError {
  constructor(message: string, init: ScriftErrorInit = {}) {
    super(message, init);
    this.name = 'APIError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
