---
name: probe-sut
description: Quick live DOM or API check — open a named playwright-cli session, snapshot the page, compare locator candidates, and answer in chat or fix one page-object locator. Use when a locator is broken, matches 0 or 2+ elements, or one endpoint's behaviour is in doubt. For a full feature walk that writes an artifact, use analyse-sut.
---

# probe-sut

Inspect one thing on the live system, report, stop. No artifact.

## UI

```bash
playwright-cli -s=probe open <TOOLSHOP_UI_URL>/<path>
playwright-cli -s=probe snapshot
```

Read the snapshot: role, accessible name, landmark, duplicates. Then compare candidates and keep the first tier with count 1 (see `create-locators`):

```bash
playwright-cli -s=probe run-code "return {
  byRole: await page.getByRole('button', { name: 'Send' }).count(),
  byLabel: await page.getByLabel('Send').count(),
}"
```

Signed-in pages: `playwright-cli -s=probe state-load .auth/customer.json` first (written by `tests/global.setup.ts`).

## API

Fire the request with `curl` or `playwright-cli run-code` and record status + body. The answer is always observed behaviour, never the documentation's claim.

## Report

| Candidate | Tier | Count | Action verified |
|---|---|---|---|
| `getByRole('button', { name: 'Send' })` | 1 | 1 | click ✅ |

If asked to fix a page object, change only that locator in `src/pages/` and re-run the spec. Close the session: `playwright-cli -s=probe close`.
