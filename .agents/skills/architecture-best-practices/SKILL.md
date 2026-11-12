---
name: architecture-best-practices
description: The layer model of this Playwright framework — what belongs in a spec, flow, page object, API client, fixture, data record, or helper, and which direction dependencies may point. Use when deciding where code goes, designing a new helper, or reviewing structure.
---

# architecture-best-practices

## Layers (top calls down, never up)

| Layer | Path | Owns | Must not |
|---|---|---|---|
| Spec | `tests/api`, `tests/ui` | Scenario, steps, assertions with messages | locators, URLs, literals, `page.goto`, raw `request` |
| Fixtures | `tests/fixtures` | Lifecycle: build objects, seed, clean up; the `@fixtures` barrel | assertions, business rules |
| Page object | `src/pages` | DOM knowledge: locator getters + user operations | assertions, test data, fixtures |
| API client | `src/helpers/api` | One method per endpoint, typed payloads, returns `APIResponse` | assertions, test data |
| Data | `src/data` | Enums, rules, copy, builders, Zod schemas | I/O |
| Config | `src/config` | Env, URLs, timeouts | logic |

Dependency direction: spec → fixtures → page objects / API clients → data, config. A lower layer never imports a higher one.

## Principles

- **Abstraction level = user operation.** `contactPage.submit()`, not `clickButton()`; `contactApi.send(payload)`, not `request.post('/messages')`.
- **Composition over inheritance.** Only `BasePage` / `BaseApi` are base classes. A page that needs a region composes a component.
- **Dependency injection through fixtures.** Classes receive `Page` / `APIRequestContext` / token in the constructor; they never read globals or create their own context.
- **One reason to change.** If a class mixes DOM, data, and assertions, split it.
- **Reuse before create.** Search the target layer before adding a page object, API client, fixture, data record, or helper.
- **Parsing and calculating is not a page's job.** A pure helper in `src/helpers/` (or the data module) takes values and returns values.

Enforced by: ast-grep `no-request-context-outside-api-helper`, `no-fixture-in-page-object`, `no-goto-in-spec`, `no-page-locator-in-spec`; ESLint `no-restricted-imports`.
