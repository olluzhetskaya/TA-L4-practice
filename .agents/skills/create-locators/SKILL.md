---
name: create-locators
description: Choose Playwright locators that survive UI change — semantic, user-facing, never CSS or XPath. Use when writing or fixing page-object locators, or reading locators out of an analyse-sut artifact.
---

# create-locators

Pick the highest tier that matches **exactly one** element, probed on the live page (`probe-sut`).

| Tier | Locator | Use for |
|---|---|---|
| 1 | `getByRole(role, { name })` | buttons, links, headings, textboxes, comboboxes, alerts |
| 2 | `getByLabel(text)` | form fields with a visible label |
| 3 | `getByText(text)` (+ `exact`) | static copy with no role |
| 4 | `getByPlaceholder`, `getByAltText`, `getByTitle` | when no role / label exists |
| 5 | `getByTestId(id)` | only when the product ships test ids and tiers 1–4 are ambiguous |

Rules:

- Never `page.locator('.css')`, XPath, or positional `nth(0)`. A scope (`getByRole('dialog').getByRole('button', …)` or `.filter({ hasText })`) beats an index.
- The accessible name is the **rendered** text. It differs from the wording of the test case; take it from the snapshot.
- Names that come from the product (labels, copy) are named constants in `src/data/`, not inline strings in the page object when a test also asserts on them.
- Dynamic text (counts, ids, dates) is matched with a regular expression or a data-derived value — never a literal copied from one run.
- Read state with locators and auto-retrying assertions (`toHaveText`, `toHaveValue`, `toBeVisible`), not `textContent()` + compare.
- Record the tier and count in the analyse-sut artifact (`locators[].notes`) when you go below tier 2.

Enforced by: ast-grep `no-css-selector-in-spec`, `no-nth-zero`, `no-page-locator-in-spec`.
