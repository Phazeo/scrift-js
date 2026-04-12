/**
 * SDK version, surfaced in the `User-Agent` header.
 *
 * This is intentionally a hand-maintained constant rather than a dynamic
 * read of package.json, so the value is baked into the bundle and works in
 * every runtime (browser, Deno, Cloudflare Workers, edge) without needing
 * JSON import assertions or filesystem access.
 *
 * Keep this in sync with `package.json` on every release.
 */
export const VERSION = '0.2.0';
