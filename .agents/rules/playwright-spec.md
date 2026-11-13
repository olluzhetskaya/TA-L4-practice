---
trigger: glob
globs: "tests/**/*.spec.ts"
description: "Construction patterns for Playwright spec files — assertions, imports, data, cleanup, timing."
---

# Writing a Playwright Spec

## Import

Always import `test` and `expect` from `@fixtures`, never from `@playwright/test`.

```typescript
// ❌
import { test, expect } from "@playwright/test"

// ✅
import { test, expect } from "@fixtures"
```

**Enforced by:** ESLint `no-restricted-imports`

---

## Dependency Injection — No Direct Instantiation

All dependencies flow through fixtures. Never instantiate POMs, API helpers, or test utilities directly in spec code.

```typescript
// ❌
const campaignPage = new ManualApiCampaignsPage(page)

// ✅ Injected via fixture
test("verify campaign status", async ({ campaignPage }) => {
  await campaignPage.navigateTo()
})
```

**Critical:** No raw `page.*` calls (e.g., `page.waitForEvent('download')`). All browser operations must be wrapped in a POM method or helper, then injected. Raw Playwright API bypasses the abstraction layer and breaks testability.

---

## No Leaked Seeding Constants

Never import or re-export seeding implementation details (test data constants, seed values, fixture constants) into a spec. All test constants must flow through fixtures.

```typescript
// ❌ Seeding constant imported directly
import { TEST_ACCOUNT_EMAIL, SCHEDULED_CAMPAIGN_DATE_DISPLAY } from "@fixtures"
await campaignPage.scheduleAt(SCHEDULED_CAMPAIGN_DATE_DISPLAY)

// ✅ Data flows through fixtures
test("schedule campaign", async ({ scheduledCampaignState, campaignPage }) => {
  await campaignPage.scheduleAt(scheduledCampaignState.dateDisplay)
})
```

Exception: Global truly-constant values (`HttpStatus`, `WaitTimeout`) are OK because they are not seeding data.

---

## No Module-Scope Mutable State

Never declare `let` at module scope and mutate it inside `test()` callbacks. Each test must be independently runnable.

```typescript
// ❌
let createdId: string
test("A", async () => {
  createdId = await api.create(data)
})
test("B", async () => {
  await api.use(createdId)
}) // depends on A

// ✅
test("B", async ({ api }) => {
  const { id } = await api.create(generateData())
  await api.use(id)
})
```

---

## Assertions — concrete, not boolean

Assertions must be concrete: compare against the **API response**, never against boolean conditions or seeding constants.

```typescript
// ✅ Read from API via fixture, assert concrete value
const campaign = toCampaignView(await staffApi.getById(id))
await expect(campaignPage.getStatusLabel()).toHaveText(campaign.statusDisplay)

// ❌ Boolean assertion (loses specificity)
await expect(campaignPage.getStatusLabel()).toBeTruthy()

// ❌ Seeding constant leaked into spec
await expect(campaignPage.getStatusLabel()).toHaveText(SEEDED_STATUS)
```

Use `toBeHidden()` / `toBeDisabled()` — not `.not.toBeVisible()` / `.not.toBeEnabled()`.
Use `toBeOK()` when any 2xx is the contract; use `response.status()` against `HttpStatus.*` when the exact code matters.

---

## Compare UI Against Validated API Response

All setup — creating test data, seeding via API — belongs in the fixture. The spec receives a pre-seeded state and only asserts. Never create or modify data in the spec.

```typescript
// ❌ Creation in spec; imports fixture constants
import { SCHEDULED_DATE_DISPLAY } from "@fixtures"
test("schedule campaign", async ({ campaignPage, staffApi }) => {
  const created = await staffApi.create({ scheduledAt: SCHEDULED_DATE_DISPLAY })
  await expect(campaignPage.getScheduledAt()).toContainText(SCHEDULED_DATE_DISPLAY)
})

test("verify campaign", async ({ campaignPage, scheduledCampaign }) => {
  await expect(campaignPage.getName()).toContainText(scheduledCampaign.expectedUI)
})
```

**Fixture responsibility** (see `fixtures.md`): Create seed, call API, validate response, return object with `{ seed, created, expectedUI }`.
**Spec responsibility**: Receive injected state, assert only.

---

## No Inline Data Derivations on Response or Extracted Fields

Never apply `.split()`, arithmetic, or boolean expressions to raw data — whether from API responses or UI extraction — inside a spec. All such derivations belong in a view factory or UI helper in `src/data/`. The spec only reads computed properties.

```typescript
// ❌ Inline derivation in spec
const expectedDate = detail.scheduled_at?.split("T")[0] ?? ""
const finalCount = detail.delivered_count + detail.expired_count
const isResolved = detail.pending_count === 0

// ✅ Spec reads computed properties from the view factory
const campaign = toCampaignView(await staffApi.getById(campaignId))
expect(campaign.scheduledDateDisplay).not.toBeNull()
expect(campaign.finalCount).toBe(expectedCount)
expect(campaign.isFullyResolved).toBe(true)
```

---

## Magic Numbers in Assertions

Never hardcode expected counts or scenario-specific numbers directly in assertions. See `fixtures.md` "Scenario Counts" section for the pattern: define counts as named constants in `src/data/`, then surface them through the fixture's typed return value.

---

## No Conditional Logic in Tests

Tests assert concrete expected results. Never branch with `if/else` or ternary inside a test body to decide what to assert.

**Agent responsibility:** Prepare all prerequisites before writing the test — configure test accounts, seed data, set environment variables, or adjust fixtures. Only use `test.fixme()` if a **real blocker** is encountered during implementation (e.g., missing API endpoint, external service down). Never preemptively mark a test as fixme due to missing setup.

```typescript
// ❌ Premature fixme — agent should have configured the account
await test.step('Verify billing_status is "refunded"', async () => {
  test.fixme(true, "Requires non-zero rate account — configure env before asserting.")
})

// ✅ Agent prepared prerequisites; test runs
await test.step('Verify billing_status is "refunded"', async ({ staffApi, nonZeroRateAccount }) => {
  const result = await staffApi.closeCampaign(nonZeroRateAccount.campaignId)
  expect(result.billing_status).toBe(BillingStatus.Refunded)
})
```

**Enforced by:** ESLint `playwright/no-conditional-in-test`, `playwright/no-conditional-expect`

---

## No `try-catch` in Spec Files

Let Playwright surface errors with full context — stack trace, step name, screenshot, trace. A caught exception swallows the failure silently.

```typescript
// ❌
try {
  await staffApi.close(campaignId)
} catch (e) {
  /* swallows the failure */
}

// ✅
await staffApi.close(campaignId)
```

**Enforced by:** ESLint `no-restricted-syntax` (`TryStatement` in spec files)

---

## Async state after mutations

After an API mutation that changes UI state, use `expect.poll()`:

```typescript
await expect.poll(() => api.getStatus(id), { timeout: pollIntervals.medium }).toBe("sent")
```

---

## Timing constants

Use named constants (`testTimeouts.*`, `pollIntervals.*`) — not raw milliseconds.

---

## Test steps

Descriptive imperative ("Navigate to the campaign list", "Verify status is Running"). No `Step 1:` prefixes, no fake TMS IDs.

---

## Spec ends on an assertion

The last statement in every test body is an `expect()` call.

---

## One spec file per story — named after the feature, not the ticket

Every substory (e.g. `CRMFRONT-3146-SS4`) must have its **own** spec file(s). Never automate a new story's TC inside an existing story's spec file, even when the behaviour overlaps.

**Naming:** `<feature>.<qualifier>.spec.ts` — use the feature domain name, not the ticket ID.

```
tests/staff/manual-api/campaigns.supplier-file.api.spec.ts  ✅  SS4 API tests
tests/staff/manual-api/campaigns.supplier-file.spec.ts      ✅  SS4 UI tests
tests/staff/manual-api/campaigns.spec.ts                    ✅  SS2 UI tests  (different spec)
tests/staff/manual-api/campaigns.api.spec.ts                ✅  SS2 API tests (different spec)
```

The `automated_by` field in `data/test-design/<TICKET>.json` must point to a spec file that belongs to the same story. Pointing at another story's spec (e.g. `campaigns.spec.ts` for an SS4 TC) is wrong — implement the TC in the story's own spec file instead.

**Why:** the `spec-annotation-consistency` gate reads `automated_by` to check for `test.fixme`. If two stories share a spec file, a fixme from story A blocks the gate for story B's TCs.
