---
name: test-stability
description: Keep Playwright tests deterministic — wait strategies, timeout budgets, race conditions between a UI action and its network call. Use when a test is flaky, times out, or when writing navigation, waitForResponse, or polling code.
---

# test-stability

## Never

`page.waitForTimeout`, `setTimeout`, fixed sleeps, `networkidle` as a readiness signal, `.then()` chains. (`no-manual-sleep`, `no-then-in-async-code`, ESLint `playwright/no-wait-for-timeout`.)

## Wait for what the user waits for

| Situation | Use |
|---|---|
| Element appears / changes | `await expect(locator, msg).toBeVisible()` / `toHaveText` / `toHaveCount` |
| List content | `toHaveText([...])` on the locator — retries until the whole list matches |
| Navigation | `page.goto(path, { waitUntil: 'domcontentloaded' })`, then assert on an element |
| Click triggers a request you must observe | register `waitForResponse` **before** the click, await it after |
| Request must **not** happen | count requests with a page-level `request` listener, then assert the count after the UI settled |
| API state converges | `expect.poll(fn, msg).toBe(x)` or `expect(async () => …).toPass()` |

```typescript
const sent = page.waitForResponse(r => r.url().endsWith('/messages') && r.request().method() === 'POST')
await contactPage.submit()
expect((await sent).status(), 'form should post once').toBe(HttpStatus.OK)
```

## Timeout budget (`src/config/timeouts.ts`)

| Bucket | Value | Meaning |
|---|---|---|
| `test` | 60 s | whole test |
| `expect` | 10 s | one assertion's retry window |
| `action` | 10 s | click / fill |
| `navigation` | 30 s | goto |

No inline magic numbers (`no-inline-magic-timeout`). Raise a budget in config for a known slow endpoint, with a comment naming it; do not raise it per test.

## Typical flake causes on a live public SUT

- **Layout shift swallows a click.** The page re-renders after load; assert a stable element is visible before acting, or retry the action via an assertion on its effect.
- **Shared data.** Another user changed the record. Create your own through a fixture.
- **Rate limits / cold start.** CI retries twice; never add retries inside a test.
- **Order dependence.** Specs run `fullyParallel`; each test sets up its own state.

Diagnose with `npx playwright test <spec> --trace on` and `npx playwright show-trace`, or the `playwright-cli` skill's debug references.
