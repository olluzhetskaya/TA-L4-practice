---
name: test-data-state-management
description: Create, isolate, and clean up the state a test depends on — fixtures that seed through the API, per-test unique data, auth tokens, and polling for eventual state. Use when a precondition is needed, a test leaks data into another, or state changes asynchronously.
---

# test-data-state-management

## Principles

1. **API as setup** (strategy §4). Preconditions are created through the typed API client, never by driving the browser.
2. **Fixtures own lifecycle.** Seeding goes in a fixture before `use()`, cleanup after it. The test body never calls `create…()` inline.
3. **Own your data.** A test reads only what it created (or immutable reference data). The public SUT is shared with other people.
4. **Unique where it matters.** When the system enforces uniqueness (registration emails, names), the builder adds a run-unique suffix so parallel workers do not collide.
5. **Tokens come from setup.** `tests/global.setup.ts` writes `.auth/customer.json` once; `customerApi` reads it. Tests never log in.

## Fixture shape (illustrative)

```typescript
storedMessage: async ({ customerApi }, use) => {
  const response = await customerApi.contact.send(buildAuthenticatedContactRequest())
  const created = await readJson(response, storedMessageSchema)
  await use(created)
  // delete here when the API offers a delete; Toolshop's contact API does not
},
```

When the system has no delete endpoint, say so in the fixture and keep the data obviously synthetic.

## Eventual state

Never sleep. Assert with auto-retry:

```typescript
await expect.poll(async () => (await api.getById(id)).status(), 'record should exist').toBe(HttpStatus.OK)
await expect(async () => { … }).toPass({ timeout: testTimeouts.expect })
```

Timeouts come from `src/config/timeouts.ts`. See `test-stability` for choosing them.
