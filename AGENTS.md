# Coding conventions

Apply to every file in the framework (`src/`, `tests/`) and to the harness (`.agents/`). These rules are always on. File-scoped contracts in `.cursor/rules/` activate for the implementation layer and its consuming specs; procedural skills load on demand for a specific task. Together they guide generation before `npm run validate` checks the result.

## Never violate

- **No `waitForTimeout` / `setTimeout` sync.** Use auto-retrying assertions, `expect.poll`, or `toPass`.
- **No `any`, no `!`, no unsafe casts.** Narrow `unknown`, parse untrusted data with Zod `safeParse` (`readJson`), import generated types from `@generated/*`. Use `import type` for type-only imports.
- **No `console.log`.** Use `test.step()` names for reporting context. (`console.error` / `console.warn` are allowed in harness code.)
- **No unnecessary comments.** Keep a comment only for an external constraint, a known API gap, or a non-obvious invariant. Delete anything that restates the code or explains the agent's reasoning.
- **No `eslint-disable`.** Fix the violation, or change the config if the rule is wrong for this codebase.
- **No deep relative imports in `src/` or `tests/`.** Use the aliases: `@fixtures`, `@data/*`, `@pages/*`, `@helpers/*`, `@config/*`, `@generated/*`, `@src/*`. Harness code under `.agents/` may use relative imports.
- **No string or number literals where an enum or named constant exists.** Statuses → `HttpStatus`; choices → domain enums; limits and copy → records in `src/data/`.

## Layers

| Layer | Lives in | Rule |
|---|---|---|
| Spec | `tests/api`, `tests/ui` | `test.step` + `expect` only; imports only from `@fixtures` |
| Page object | `src/pages` | locators + user operations; never asserts, no `test.*` |
| API client | `src/helpers/api` | typed methods; the only place that calls `request.*` |
| Data | `src/data` | builders, enums, constants, Zod schemas |
| Fixture | `tests/fixtures` | seeding, teardown, wiring; exported through the `@fixtures` barrel |
| Config | `src/config` | URLs, credentials, timeouts — read from env |

## Test conventions

- Test title = manual test case title; `annotation: testCase('TC-n')`; tags from `Tag`.
- Steps: `Verify that …` / `Confirm that …`.
- Every `expect()` carries a message; expected values come from data records or API responses.
- Locators are semantic (`getByRole`, `getByLabel`, …) and live in page objects.

## Before pushing

```
npm run validate   # schemas + typecheck + eslint + ast-grep + pipeline gates + harness tests
```

`.githooks/pre-push` runs the same chain.
