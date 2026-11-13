---
trigger: glob
globs: "src/data/**/*.ts, tests/staff/specs/**/*.spec.ts, tests/client/specs/**/*.spec.ts"
description: "Data helper patterns — view factories, generator functions, named count constants, and what belongs in the @fixtures barrel."
---

# Writing Data Helpers, View Factories, and Payload Builders

Files in `src/data/` are the single source of truth for domain logic — derivations, generators, view mappings, and payload builders all live here.

---

## View Factories — No Inline Derivations

Never apply `.split()`, arithmetic, or boolean expressions to raw API response fields in specs or fixtures. Add the computed property to the view factory here in `src/data/` and read the property in the spec.

```typescript
// ✅ src/data/campaigns/campaign-view.ts
export function toCampaignView(detail: CampaignDetail) {
  return {
    scheduledDateDisplay: detail.scheduled_at?.split("T")[0] ?? null,
    finalCount: detail.delivered_count + detail.expired_count,
    isFullyResolved: detail.pending_count === 0,
  }
}
```

---

## Unique Name Generators — No Inline `Date.now()`

Generator functions live in `src/data/`. Never inline `Date.now()` or `Math.random()` anywhere in the framework.

```typescript
// ❌
const name = `Campaign-${Date.now()}`

// ✅
export function generateCampaignName(prefix: string): string {
  return `${prefix}-${Date.now()}` // only here, not inline in specs/fixtures
}
```

---

## No Inline Optional-Chain ID Resolution

When an API response has two optional fields for the same ID, extract a named helper that throws on a missing value instead of silently falling back to an empty string.

```typescript
// ❌ Repeated ?? chain — silent empty-string on missing ID
const campaignId = response.id ?? response.campaign_id ?? ""

// ✅ Named helper — throws with a clear message, used everywhere
export function getCampaignId(response: ManualApiCampaignResponse): string {
  const id = response.id ?? response.campaign_id
  if (!id) throw new Error('Campaign response contains neither "id" nor "campaign_id"')
  return id
}
```

Any `a ?? b ?? ''` (or `?? null`, `?? 0`) that recurs more than once signals a missing helper. Put it in `src/data/`, export it from `@fixtures`, and use the helper everywhere.

---

## Named Count Constants

Numeric counts used for seeding or assertions are named constants in `src/data/`. They are imported by fixtures and surfaced through the fixture's return type — never hardcoded in specs.

```typescript
// src/data/manual-api/campaign-payloads.ts
export const DUPLICATE_DELIVERED_RECORD_COUNT = 700
```

---

## Assertion Helpers — `asserts` for Non-Null Narrowing

When a view field is `T | null` but must be non-null for a specific test state, use a typed assertion helper rather than `as T` or an `if` guard. Define the helper once in `src/data/` and export it from `@fixtures`.

```typescript
// src/data/assertions.ts
import { expect } from "@playwright/test"

export function assertDefined<T>(value: T | null | undefined, message: string): asserts value is T {
  expect(value, message).not.toBeNull()
}
```

The `asserts value is T` return type tells TypeScript that after this call, `value` is narrowed to `T` — no `as` cast, no `if` branch needed at the call site.

```typescript
// ✅ — in spec
assertDefined(campaign.scheduledDateDisplay, "scheduledDateDisplay must be set")
await expect(page.getScheduledAt()).toContainText(campaign.scheduledDateDisplay) // string
```

---

## What Belongs in `src/data/` vs `@fixtures` Barrel

`src/data/` owns the implementation. `@fixtures` re-exports only what any spec may need regardless of scenario.

| Put in `src/data/`                                            | Re-export from `@fixtures`               |
| ------------------------------------------------------------- | ---------------------------------------- |
| View factories (`toCampaignView`)                             | ✅ yes                                   |
| Generator functions                                           | ✅ yes                                   |
| Domain enums                                                  | ✅ yes                                   |
| Scenario-specific counts (`DUPLICATE_DELIVERED_RECORD_COUNT`) | ❌ no — surface via fixture return value |
| Concrete seeding values (dates, URLs, texts)                  | ❌ no — read back from API response      |
