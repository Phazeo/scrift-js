# ADR-0001: Single automatic retry on HTTP 429

## Status

Accepted

## Date

2026-04-12

## Context

The SDK performs one automatic retry when the API returns HTTP 429.
Transient network errors are NOT retried automatically.

## Decision

Keep single-retry as permanent default. Reasons:

1. Simplicity — no configurable retry loop before consumer demand exists
2. 429 is the only transient API error worth auto-handling
3. Network errors are caller responsibility

## Consequences

Consumers needing zero-sleep behaviour must catch ScriftRateLimitError.
Future: add maxRetries option as non-breaking additive change.
