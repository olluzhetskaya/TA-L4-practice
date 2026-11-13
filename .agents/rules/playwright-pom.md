---
trigger: glob
globs: "src/pages/**/*.ts, src/components/**/*.ts"
description: "Construction patterns for Page Object Models and components — structure, locators, no expect, getter/action separation."
---

# Writing a Page Object or Component

## Structure

- Extends `BasePage`; inherit the constructor.
- Components are `public readonly` fields on the page — never instantiated in specs.
- Inheritance depth ≤ 2.

```typescript
export class CampaignListPage extends BasePage {
  public readonly filterBar = new CampaignFilterComponent(this.page)
}
```

---

## Locators — private, named, semantic

All locators are private. Expose each via a getter:

```typescript
private get _submitButton() {
  return this.page.getByRole('button', { name: 'Submit' })
}

getSubmitButton(): Locator {
  return this._submitButton
}
```

Priority: `getByRole` → `getByLabel` → `getByPlaceholder` → `getByText`. CSS/id only when a live-UI probe documents why a semantic selector cannot be used.

---

## No `expect` in POM methods

POMs return locators or data. Specs call `expect()`. No `verify*`, `assert*`, or `check*` methods:

```typescript
// ✅ POM returns the locator; spec asserts
getStatusLabel(): Locator { return this._statusLabel }

// ❌
async verifyStatusIsRunning() { await expect(this._statusLabel).toHaveText('Running') }
```

---

## Actions

Actions are `async`, return `void` (or a typed value from a subsequent API call), and do one thing. No conditional UI fallbacks (`if await x.isVisible()`).

```typescript
async submit(): Promise<void> {
  await this._submitButton.click()
}
```

---

## `innerText` / `inputValue` Over `textContent`

`textContent()` returns `string | null` — forces a cast or null fallback. `innerText()` and `inputValue()` return `string` directly and throw if the element is missing.

```typescript
// ❌ Returns string | null — forces unsafe cast
const text = (await element.textContent()) as string

// ✅ Returns string — throws with context if element is absent
const text = await element.innerText() // visible rendered text
const val = await element.inputValue() // form field value
```

---

## No `Promise.all` for UI Interactions

UI interactions in POM action methods must be awaited in sequence — parallel actions cause unpredictable browser state.

```typescript
// ❌ Parallel UI inside a POM action — browser state is undefined
async fillCredentials(email: string, password: string): Promise<void> {
  await Promise.all([
    this._emailInput.fill(email),
    this._passwordInput.fill(password),
  ])
}

// ✅ Sequential — each interaction completes before the next begins
async fillCredentials(email: string, password: string): Promise<void> {
  await this._emailInput.fill(email)
  await this._passwordInput.fill(password)
}
```

---

## No `waitForTimeout`

Use auto-retrying `expect(locator).toBeVisible()` or `expect.poll()` — never `page.waitForTimeout()`.
