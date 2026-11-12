---
name: create-ui-spec
description: Write Playwright UI specs and page objects for the ui-level manual test cases of one ticket, using the analyse-sut artifact as the locator and behaviour map. Use after analyse-sut for tickets with ui test cases.
---

# create-ui-spec

Automate the `level: "ui"` test cases of a ticket. Locators come from the exploration artifact — they were probed on the live page, so do not re-invent them.

## Inputs (read in this order)

1. `wiki/TEST-STRATEGY.md` — §2 (UI owns what the user sees and client-side rules), §3, §4 (API as setup), §7
2. `AGENTS.md` — coding conventions (enforced by eslint + ast-grep)
3. `.agents/manual-to-autotests-pipeline/test-cases/<TICKET>.json` — the ui test cases: the Jira/Xray issues whose `fields.components[0].name` is `ui` (steps in `fields.customfield_10004.steps[]`)
4. `.agents/manual-to-autotests-pipeline/artifacts/explore-<TICKET>.json` — `locators`, `scenarios`, `findings`, `pomPlan`

If the artifact is missing or fails its gate, stop: run `analyse-sut` first.

## Supporting skills

Read each one when its step comes up — they hold the rules this skill only names.

| Step | Skill |
|---|---|
| Decide which layer owns what | `architecture-best-practices` |
| Page object structure | `pom-builder` |
| Choosing and verifying locators | `create-locators`, `probe-sut`, `playwright-cli` |
| Data records, enums, builders | `data-layer`, `typescript-types` |
| Fixtures, API setup | `test-data-state-management` |
| Waits, timeouts, flake | `test-stability` |
| Known bug → `test.fail`, tags, `testCase()` | `playwright-annotations` |
| Review before the PR | `code-review` |
| Branch, PR, CI | `github-ci` |

## Steps

### 1. Page object — user operations, not DOM actions

Plan from `pomPlan.pages`; reuse an existing page object when one covers the page.

- Layers: locator getters (public `Locator`-returning methods) → user operations (`fillForm`, `submit`, `open`) → nothing else.
- Locators are copied from the artifact (`locators[].locator`); they are semantic, never CSS.
- Page objects never assert and never call `test.step` / `test.info`.
- Navigation lives in the page object (`open()`); specs never call `page.goto`.
- When a test case asserts that **nothing is sent**, expose an observer (e.g. `trackSubmissions()`) on the page object — absence is only provable on the network.

### 2. Data and fixtures

- Form inputs, expected copy, labels, and limits are named records in `src/data/` (domain enums for choices). The spec has no inline strings for UI copy.
- Register the page object as a fixture in `tests/fixtures/` and export through `@fixtures`.
- Preconditions are reached through the API (strategy §4), never by driving the browser.

### 3. Write the spec

File: `tests/ui/<TICKET>.<slug>.ui.spec.ts` — the name must end in `.ui.spec.ts`.

```typescript
import { test, expect, Tag, testCase } from '@fixtures'

test(
  '<exact test case title>',
  { tag: [Tag.Ui, Tag.Regression], annotation: testCase('TC-3') },
  async ({ contactPage }) => {
    await test.step('Verify that <business outcome>', async () => {
      await contactPage.open()
      await expect(contactPage.getSendButton(), 'Send should be available').toBeVisible()
    })
  },
)
```

Rules:

- Title is the test case title, character for character. One `test()` per test case.
- Steps are named `Verify that …` / `Confirm that …`.
- Only auto-retrying assertions on locators (`toBeVisible`, `toHaveText`, `toHaveValue`); never `textContent()` then compare.
- The spec calls page-object getters inline inside `expect()` — it never holds a raw `Locator` and never builds one (`page.getBy…`, `page.locator` are banned in specs).
- Every `expect()` has a message. Use `.toBeHidden()` rather than `.not.toBeVisible()`.
- Follow `findings`: `assert-observed` means assert the real wording/behaviour from the artifact; `annotate-gap` means keep the assertion the acceptance criterion demands and mark the test `test.fail(true, 'BUG: …')` rather than loosening it.

### 4. Gates and run

```bash
npm run runGates -- tests/ui/<spec file>         # eslint + ast-grep + traceability
npx playwright test --project=ui <spec file> --reporter=line
```

On a locator error, re-open the page with `analyse-sut`'s session and re-probe — do not guess a new selector. On an assertion error, check the artifact's `findings` before changing the assertion.

### 5. Hand off

Report: spec path, page objects created/changed, test cases automated (ids), anything annotated and why.
