---
trigger: glob
globs: "tests/fixtures/**/*.ts, tests/staff/specs/**/*.spec.ts, tests/client/specs/**/*.spec.ts"
description: "Fixture construction patterns — teardown cleanup, unique name generators, optional-chain ID helpers, and fixture barrel exports."
---

# Writing Fixtures

## Pattern — Seed via API, return typed state, assert in spec

Fixtures own all seeding. The spec receives a pre-built state object and only asserts.

```typescript
// tests/fixtures/staff/campaign.fixture.ts
import { generateCampaignName } from "@data/staff/campaign-test-data"
import { toCampaignView } from "@data/staff/campaign-view"

interface CampaignState {
  campaignId: string
  expectedUI: ReturnType<typeof toCampaignView>
}

export const test = staffTest.extend<{ campaign: CampaignState }>({
  campaign: async ({ staffApiClient }, use) => {
    const name = generateCampaignName("Autotest")
    const res = await staffApiClient.campaigns.create({ name })
    await use({ campaignId: res.id, expectedUI: toCampaignView(res) })
    await staffApiClient.campaigns.delete(res.id)
  },
})

// ✅ Spec receives state, asserts only — no data creation
test("verify campaign name", async ({ campaign, campaignPage }) => {
  await expect(campaignPage.getName()).toHaveText(campaign.expectedUI.name)
})
```

---

## Cleanup in Fixture Teardown

All test data cleanup must run after `use()` — never only before it (skipped when the test fails mid-setup) or omitted entirely.

```typescript
// ❌ Cleanup before use() — skipped if create() throws mid-way
export const test = base.extend<{ order: Order }>({
  order: async ({ api }, use) => {
    const { id } = await api.create(generateData())
    await use({ id })
    // forgot cleanup — data leaks on test failure
  },
})

// ✅ Cleanup after use() — always runs regardless of test outcome
export const test = base.extend<{ order: Order }>({
  order: async ({ api }, use) => {
    const { id } = await api.create(generateData())
    await use({ id })
    await api.delete(id)
  },
})
```

---

## Unique Name Generators — No Inline `Date.now()`

Entity names must come from generator functions in `src/data/`. Never inline `Date.now()` or `Math.random()` in fixtures.

```typescript
// ❌
const name = `Campaign-${Date.now()}`

// ✅
import { generateCampaignName } from "@data/client/campaign-test-data"
const name = generateCampaignName("Test Campaign")
```

---

## No Inline Optional-Chain ID Resolution

When an API response has two optional fields for the same ID, never resolve them with `??` chains in fixtures. Extract a named helper in `src/data/` that throws on missing value.

```typescript
// ❌ Silent empty-string on missing ID
const campaignId = response.id ?? response.campaign_id ?? ""

// ✅ Throws with a clear message
const campaignId = getCampaignId(response)
```

Any `a ?? b ?? ''` (or `?? null`, `?? 0`) that recurs more than once signals a missing helper.

---

## Fixture Barrel — What Belongs in `@fixtures`

**Export from `@fixtures`:**

- Domain enums and status constants
- Aggregate thresholds (`CAMPAIGN_MESSAGE_COUNT`)
- HTTP status sentinels, timeout/interval constants
- Helper functions used across specs (`getCampaignId`, `toCampaignView`)
- Payload builders

**Do NOT export from `@fixtures`:**

- Concrete seeding values (dates, texts, URLs) embedded in a specific payload builder
- Scenario-specific counts internal to one fixture (delivered count, unique-phone count) — these travel through the fixture's typed return value only

```typescript
// ❌ Scenario-specific count re-exported from @fixtures barrel
export { DUPLICATE_DELIVERED_RECORD_COUNT } from "../../src/data/manual-api/campaign-payloads"

// ✅ Count imported from src/data/ and surfaced as a typed field on the fixture return value
import { DUPLICATE_DELIVERED_RECORD_COUNT } from "../../src/data/manual-api/campaign-payloads"
// fixture interface:
deliveredCount: number // = DUPLICATE_DELIVERED_RECORD_COUNT
// fixture body:
return { deliveredCount: DUPLICATE_DELIVERED_RECORD_COUNT, ...rest }
```

---

## Scenario Counts — Surface via Return Value, Not Re-exported

Scenario-specific counts (e.g. number of delivered records for one fixture) are defined as named constants in `src/data/` (see `data.md`). The fixture imports the constant and exposes it as a typed field — the spec reads it from the fixture, never imports the raw constant directly.

```typescript
// tests/fixtures/manual-api.fixture.ts
import { DUPLICATE_DELIVERED_RECORD_COUNT } from "../../src/data/manual-api/campaign-payloads"

interface BillingState {
  deliveredCount: number
  // ...
}

// inside fixture body:
await use({ deliveredCount: DUPLICATE_DELIVERED_RECORD_COUNT, ...rest })
```
