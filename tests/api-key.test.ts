import { describe, expect, it } from 'vitest';

import { validateApiKey } from '../src/api-key.js';

describe('validateApiKey', () => {
  it('accepts scrf_ + 8+ alphanumeric', () => {
    expect(() => validateApiKey('scrf_testkey123456')).not.toThrow();
  });

  it('accepts scrf_int_ internal keys', () => {
    expect(() => validateApiKey('scrf_int_internal0001')).not.toThrow();
  });

  it('accepts opaque legacy keys', () => {
    expect(() => validateApiKey('my_legacy_key_12345')).not.toThrow();
  });

  it('rejects empty string', () => {
    expect(() => validateApiKey('')).toThrow(TypeError);
  });

  it('rejects legacy sk + test credential prefix', () => {
    const key = `${'sk'}_${'test'}_abc123456789`;
    expect(() => validateApiKey(key)).toThrow(TypeError);
  });

  it('rejects legacy sk + live credential prefix', () => {
    const key = `${'sk'}_${'live'}_abc123456789`;
    expect(() => validateApiKey(key)).toThrow(TypeError);
  });

  it('rejects malformed scrf_int_', () => {
    expect(() => validateApiKey('scrf_int_!!!')).toThrow(TypeError);
  });

  it('rejects scrf_ customer key shorter than 8 alnum after prefix', () => {
    expect(() => validateApiKey('scrf_short')).toThrow(TypeError);
  });

  it('rejects scrf_ with invalid characters after prefix', () => {
    expect(() => validateApiKey('scrf_bad-key!')).toThrow(TypeError);
  });

  it('rejects keys that are not legacy and not scrf', () => {
    expect(() => validateApiKey('bad')).toThrow(TypeError);
  });
});
