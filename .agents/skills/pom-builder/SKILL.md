---
name: pom-builder
description: Create or change a page object in src/pages/ — locator getters, user operations, no assertions. Use when the analyse-sut artifact's pomPlan lists a page to create, or when a spec needs a new interaction.
---

# pom-builder

A page object is the only place that knows the page's DOM. Specs call it through a fixture.

## Structure

```typescript
export class ContactPage extends BasePage {
  async open(): Promise<void> {                       // 1. navigation
    await this.page.goto(CONTACT_PATH, { waitUntil: 'domcontentloaded' })
  }

  getSendButton(): Locator {                          // 2. locator getters (public, return Locator)
    return this.page.getByRole('button', { name: 'Send' })
  }

  async fillForm(input: ContactFormInput): Promise<void> { … }   // 3. user operations
  async submit(): Promise<void> { … }
}
```

## Rules

1. `extends BasePage`; never declare your own `page` field.
2. Locators are **getters** returning `Locator` (semantic, from the artifact — see `create-locators`). Specs pass them to `expect()`; the page object never asserts.
3. Operations are **user intents** (`search`, `fillForm`, `submit`), not DOM clicks. One operation may click several things.
4. Navigation belongs here: paths are constants, `open()` waits for `domcontentloaded`. If a click navigates, wait for the URL in the same method.
5. Inputs arrive as typed arguments or data records from `src/data/`; no hard-coded test data in the class.
6. No boolean-returning methods (`isVisible()`): they defeat auto-retry. Return the `Locator`.
7. To prove "nothing was sent", expose a network observer (`trackSubmissions()`), not a sleep.
8. Do not import fixtures, `expect`, or `test` into a page object. Page objects are fixtures' dependency, never the reverse.
9. Register the class in `tests/fixtures/toolshop.fixture.ts` and export through `@fixtures`.

Reuse: search `src/pages/` before creating. Extract a component class when two pages share a region.
