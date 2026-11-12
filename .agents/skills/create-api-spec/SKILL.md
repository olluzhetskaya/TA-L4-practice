---
name: create-api-spec
description: Write Playwright API specs for the api-level manual test cases of one ticket, using the analyse-sut artifact as the contract. Typed client, data records, fixtures, and assertions on responses and persisted state. Use after analyse-sut for tickets with api test cases.
---

# create-api-spec

Automate the `level: "api"` test cases of a ticket. The manual test case defines scope and title; the exploration artifact defines what the system actually does.

## Inputs (read in this order)

1. `wiki/TEST-STRATEGY.md` — §2 (API owns contracts, rules, boundaries, persistence), §4, §5, §7
2. `AGENTS.md` — coding conventions (enforced by eslint + ast-grep)
3. `.agents/test-cases/<TICKET>.json` — the api test cases
4. `.agents/artifacts/explore-<TICKET>.json` — `apiCalls`, `scenarios`, `findings` for those test cases

If the artifact is missing or fails `npm run runGates -- .agents/artifacts/explore-<TICKET>.json`, stop: run `analyse-sut` first.

## Supporting skills

Read each one when its step comes up — they hold the rules this skill only names.

| Step | Skill |
|---|---|
| Decide which layer owns what | `architecture-best-practices` |
| Data records, enums, builders, response schemas | `data-layer`, `typescript-types` |
| Fixtures, seeding, polling for state | `test-data-state-management` |
| Waits, timeouts, flake | `test-stability` |
| Known bug → `test.fail`, tags, `testCase()` | `playwright-annotations` |
| Re-probe an endpoint | `probe-sut` |
| Review before the PR | `code-review` |
| Branch, PR, CI | `github-ci` |

## Steps

### 1. Map findings to assertions

For each api test case, walk its steps against `findings`:

| Resolution | What the spec does |
|---|---|
| none | assert what the test case says |
| `assert-observed` | assert the **observed** behaviour (e.g. the status the system really returns) |
| `move-to-ui` | do not assert at API level; leave a `gap` annotation pointing at the UI test case |
| `annotate-gap` | a product bug: keep the assertion the acceptance criterion demands and mark the test `test.fail(true, 'BUG: …')`; never loosen the assertion, and give a bug-affected test case its own `test()` so the rest keeps guarding |

### 2. Client, data, fixtures — reuse before creating

- Search `src/helpers/api/` for an existing client method. Add a method only when `apiCalls[].needsClient` or search says none exists; type payloads from `@generated/*`.
- Payload builders, enums, constants, and Zod response schemas live in `src/data/`. No literals for statuses, subjects, limits, or messages in the spec — use `HttpStatus`, domain enums, named constants.
- Fixtures live in `tests/fixtures/` and are exported through the `@fixtures` barrel. Preconditions (tokens, seeded entities) come from fixtures, never inline in the test body.
- Every response body is read through `readJson(response, schema)` — never `as SomeType`.

### 3. Write the spec

File: `tests/api/<TICKET>.<slug>.api.spec.ts` — the name must end in `.api.spec.ts`.

```typescript
import { test, expect, Tag, testCase, HttpStatus, readJson } from '@fixtures'

test(
  '<exact test case title>',
  { tag: [Tag.Api, Tag.Regression], annotation: testCase('TC-1') },
  async ({ toolshopApi }) => {
    await test.step('Verify that <business outcome>', async () => {
      const response = await toolshopApi.contact.send(payload)
      expect(response.status(), 'why this status').toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    })
  },
)
```

Rules:

- Title is the test case title, character for character. One `test()` per test case.
- Steps are named `Verify that …` / `Confirm that …` — business outcome, not endpoint path.
- Import only from `@fixtures`. Every `expect()` has a message.
- When state changes over time, poll with `expect.poll()` / `toPass()`; never sleep.
- No seeded-internal values in assertions: compare against the fixture's return value or a data record.
- No `request.post(...)` in specs — go through the typed client.

### 4. Gates and run

```bash
npm run runGates -- tests/api/<spec file>        # eslint + ast-grep + traceability
npx playwright test --project=api <spec file> --reporter=line
```

Fix every finding in the code — never add `eslint-disable`. A failing assertion means: re-probe the endpoint, then either the data is wrong or the test case needs a finding; do not loosen the assertion to make it pass.

The Cursor stop hook runs the spec gates; `git push` / `gh pr create` are blocked until `npm run validate:push` passes.

### 5. Hand off

Report: spec path, test cases automated (ids), test cases deliberately skipped or annotated and why.
