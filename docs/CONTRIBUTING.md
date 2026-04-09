# Contributing to `@scrift/sdk`

Thanks for your interest in improving the SDK! This document covers how
to get a development environment set up, the quality bar we hold every
PR to, and the process for shipping changes.

## Prerequisites

- **Node.js 18 or higher.** The SDK and test suite both rely on the
  built-in `fetch`, `AbortController`, and `URL` APIs available in Node
  18+.
- **npm** (bundled with Node). Other package managers (`pnpm`, `yarn`,
  `bun`) will work for installing deps, but CI runs against `npm`.

Check your Node version:

```bash
node --version  # must print v18.x or higher
```

## Setup

```bash
git clone https://github.com/phazeo/scrift-js.git
cd scrift-js
npm install
```

That's it. There are no secrets, no services to start, no database to
seed — the SDK is a pure HTTP client.

## Project structure

See [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) for the full layer
diagram and the rules around dependency direction. The short version:

```
src/
├── client.ts       ← entry point, wires resources to HttpClient
├── http.ts         ← the ONLY place that touches fetch / headers / retries
├── errors.ts       ← error classes (ScriftError + 5 subclasses)
├── types.ts        ← all TypeScript types and interfaces
└── resources/      ← thin method wrappers, one file per API surface
```

## Quality gates

Every PR must pass all of the following:

```bash
npm run typecheck      # tsc --noEmit, strict mode
npm run test           # vitest, all suites
npm run test:coverage  # coverage ≥ 85% statements / branches / functions / lines
npm run build          # tsup produces ESM + CJS + .d.ts
```

A single command that runs the lot:

```bash
npm run typecheck && npm run test:coverage && npm run build
```

### Coverage floor

Coverage is enforced at **85% minimum** across statements, branches,
functions, and lines, via `vitest.config.ts`. New code should not lower
coverage. In practice we aim for ≥ 95% on new files.

## Making changes

### Adding a new endpoint

1. Add any new response shapes to `src/types.ts` — preserve the API's
   camelCase field names exactly.
2. Add a one-line method to the appropriate file in `src/resources/`.
3. Add tests under `tests/{resource}.test.ts`: one happy-path test and
   at least one error test.
4. Update the method-reference table in `README.md`.

You should not need to touch `http.ts`, `client.ts`, or `errors.ts`
for a new endpoint. If you do, something unusual is going on — flag it
in the PR description so reviewers can sanity-check.

### Adding a new resource

1. Create `src/resources/{name}.ts`.
2. Register and expose it in `src/client.ts`.
3. Re-export the class from `src/index.ts`.
4. Create `tests/{name}.test.ts` with its own fixture setup.

### Changing error behavior or the HTTP layer

Changes to `http.ts` or `errors.ts` are load-bearing. They affect
every single SDK call, so please:

- Open an issue first to discuss the change.
- Add tests that cover both the new behavior and any previously
  covered behavior that could regress.
- Bump the MAJOR version if the change breaks existing error-handling
  code in downstream apps.

## Testing conventions

- Tests use **vitest** and live in `tests/`.
- **Never make real network calls.** The `createFetchStub` helper in
  `tests/fixtures.ts` builds a queue-backed fake `fetch`. Pass it
  through the `fetch` constructor option on `Scrift`.
- One `describe` block per method, one `it` per behavior. Short,
  focused assertions beat long omnibus tests.
- Error tests should assert on the class (`instanceof`), the status
  code, and the error code — not just the class.

## Submitting a PR

1. Fork and create a feature branch: `git checkout -b feat/your-feature`.
2. Make your changes. Keep the PR focused — one logical change per PR.
3. Run all quality gates locally and make sure they pass.
4. Open a PR against `main`. In the description, explain:
   - What the change does.
   - Why it's needed.
   - Any user-facing impact (new methods, new error classes, etc.).
5. A maintainer will review and either merge or request changes.

## Reporting bugs

Open an issue at
[github.com/phazeo/scrift-js/issues](https://github.com/phazeo/scrift-js/issues)
with:

- Your Node.js version (`node --version`).
- Your SDK version (`npm ls @scrift/sdk`).
- A minimal reproduction (5–20 lines is ideal).
- What you expected to happen.
- What actually happened, including the full error.

## Questions

Email `hello@phazeo.com` or open a GitHub Discussion.
