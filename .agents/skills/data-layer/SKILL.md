---
name: data-layer
description: Where test data lives and how to model it — payload builders, enums, constants, Zod response schemas in src/data/, wired through the @fixtures barrel. Use before writing any spec or adding a test case; every assertion value must trace back to a data record, an enum, or a response.
---

# data-layer

Specs contain no literals for statuses, domain values, limits, UI copy, or URLs. Those live in `src/data/` and arrive through `@fixtures`.

## What goes where

| Need | Home | Example |
|---|---|---|
| Closed set of values | enum in `src/data/enums.ts` | `HttpStatus.UNPROCESSABLE_ENTITY`, `ContactSubject.Webmaster` |
| Business limits / thresholds | `as const` record in the domain module | `ContactRules.messageMaxLength` |
| Rendered copy and labels | `as const` record | `ContactCopy.confirmation`, `ContactFieldLabel.email` |
| Request / form payloads | builder with overrides | `buildContactRequest({ email: 'bad' })` |
| Generated input | tiny pure helper | `textOfLength(251)` |
| Response shape | Zod schema + `readJson(response, schema)` | `contactMessageSchema` |

## Rules

- One domain module per feature (`src/data/<feature>.ts`); shared enums in `enums.ts`. Export everything the spec needs through `tests/fixtures/index.ts`.
- Builders return **valid** data by default; a test overrides exactly the field under test, so the intent is visible (`buildContactRequest({ email: 'not-an-email' })`).
- Boundaries come from the rule's named constant plus one (`ContactRules.overMaxLength`), never `251` typed in a spec. Where the limit is documented once, derive the "over" value in the record.
- Type payloads from `@generated/toolshop-api` when the OpenAPI type exists; otherwise a Zod schema.
- Never parse a response with `as SomeType`. Use `readJson` (Zod `safeParse`) or `expect(...).toMatchObject`.
- Data the system requires to be unique is generated in the builder, never copied from a previous run.
- Values observed in the analyse-sut artifact (`observed[]`) become constants here when more than one test needs them.

Enforced by: ast-grep `no-status-literal-in-assert`, `no-hardcoded-url-in-api`, ESLint `no-restricted-imports`.
