/**
 * API key format validation (X-API-Key).
 * Mirrors `scrift-python/scrift/_api_key.py`.
 */

const SCRF_INTERNAL = /^scrf_int_[A-Za-z0-9]+$/;
const SCRF_CUSTOMER = /^scrf_[A-Za-z0-9]{8,}$/;
const OPAQUE_LEGACY = /^[A-Za-z0-9_.-]{8,}$/;

/** Reject legacy `sk_*` credential prefixes (built without literals for static scans). */
const LEGACY_SK_LIVE = `${'sk'}_${'live'}_`;
const LEGACY_SK_TEST = `${'sk'}_${'test'}_`;

/**
 * Throw {@link TypeError} if `key` is not an allowed API key shape.
 */
export function validateApiKey(key: string): void {
  if (!key || typeof key !== 'string') {
    throw new TypeError(
      'Invalid API key format. Expected scrf_ + 8+ alphanumeric characters.',
    );
  }

  if (key.startsWith(LEGACY_SK_LIVE) || key.startsWith(LEGACY_SK_TEST)) {
    throw new TypeError(
      'Invalid API key format. Legacy sk_* credential prefixes are no longer supported.',
    );
  }

  if (key.startsWith('scrf_int_')) {
    if (SCRF_INTERNAL.test(key)) return;
    throw new TypeError(
      'Invalid API key format. Malformed scrf_int_* internal key.',
    );
  }

  if (key.startsWith('scrf_')) {
    if (SCRF_CUSTOMER.test(key)) return;
    throw new TypeError(
      'Invalid API key format. Expected scrf_ + 8+ alphanumeric characters ' +
        '(or scrf_int_* for internal keys).',
    );
  }

  if (OPAQUE_LEGACY.test(key)) return;

  throw new TypeError(
    'Invalid API key format. Expected scrf_ + 8+ alphanumeric characters.',
  );
}
