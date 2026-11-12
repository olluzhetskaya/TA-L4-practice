---
name: analyse-sut
description: Walk the live system under test for one ticket and write the exploration artifact (semantic locators, real network contract, scenarios, findings) that the spec skills build on. Use when manual test cases need to be automated and nothing is known yet about the live UI or API. Do not use to write specs or page objects.
---

# analyse-sut

Turn manual test cases into **facts about the live SUT**. The artifact you write is the only input the spec skills trust — test-case wording is a guess, the live system is the truth.

Do not invent a locator or a status code you did not observe. If the session cannot open, stop and report.

## Inputs

- `.agents/manual-to-autotests-pipeline/test-cases/<TICKET>.json` — manual test cases (schema: `.agents/manual-to-autotests-pipeline/input-validation/test-cases.schema.json`)
  A Jira/Xray export: one issue per test case. `key` is the test case id, `fields.summary` its title, `fields.components[0].name` its level (`api` or `ui`), `fields.labels` the acceptance criteria it covers, `fields.issuelinks` the story and the preconditions, and `fields.customfield_10004.steps[]` the steps (`action`, `data`, `expected result`).
- `.agents/manual-to-autotests-pipeline/stories/<TICKET>.md|json` — optional context for the acceptance criteria
- `wiki/TEST-STRATEGY.md` — **read first**: §1–§3 (what each level owns) and §6 (contracts come from the live SUT)

## Output

One file: `.agents/manual-to-autotests-pipeline/artifacts/explore-<TICKET>.json`, matching `references/exploration.schema.json`. Read that schema before writing.

## Supporting skills

| When | Skill |
|---|---|
| Driving the browser: sessions, snapshots, `run-code`, network log | `playwright-cli` |
| Choosing a locator tier and proving count = 1 | `create-locators` |
| Re-checking a single element or endpoint after the walk | `probe-sut` |

## Steps

### 1. Read the strategy and the test cases

Note each test case's `level`. API cases need the network contract; UI cases need locators and observable outcomes. Every test case needs at least one scenario at its own level.

### 2. Resolve URLs and auth

- URLs: `src/config/env.ts` (overridable through `.env`). Never copy a host into the artifact from memory.
- Credentials: only what the project already provides (`.env`, `.env.example`, `src/config/env.ts`). If a test case needs a role you cannot sign in as, **stop and ask** — never guess credentials.
- If a bearer token is needed, record where it comes from in `meta.authFile`; otherwise `null`.

### 3. API pre-flight — before touching the UI

For every API step in the test cases, fire a real request and record what happened. If the SUT publishes an OpenAPI document, read it for field names, then verify against behaviour.

For each endpoint, probe:

- the happy path and **each** negative / boundary case the test case lists
- one extra neighbour of each rule (just below, just above, field omitted) — rules are often enforced on one side of the boundary or in the client only
- the same call without credentials when the test case mentions auth

Record per probe: the request in words, the HTTP status, and the response body shape (not a full dump) in `apiCalls[].observed`. Required fields beyond the test case, envelope shapes, and status codes that differ from the test case all matter.

### 4. UI walk

Use a named `playwright-cli` session so state is isolated:

```bash
playwright-cli -s=explore-<TICKET> open <uiURL>/<path>
playwright-cli -s=explore-<TICKET> snapshot --filename=.agents/manual-to-autotests-pipeline/artifacts/_snap-<TICKET>.yaml
```

Single-page apps render after load — snapshot again if the page looks empty.

For each UI test case step:

1. Locate the element with the first tier that gives exactly one match: `getByRole` → `getByLabel` → `getByText` / `getByPlaceholder` → a scoped version of those. Never CSS, XPath, or `nth`.
2. Perform the action (`fill`, `select`, `click`) and record it in `verifiedBy`; use `snapshot` for elements you only read and `assert` for outcomes you observed.
3. Record the **rendered** text in `uiLabel` — product copy often differs from the test case wording (`tcAction`) and from the label (an error can say "Email" while the label says "Email address").
4. Record dialogs: `opensModal` + `modalDismiss`; a confirm button that starts disabled: `buttonState`.
5. Run `playwright-cli network` after actions that should (or should not) call the server. "Nothing was sent" must be **seen** in the network log, not assumed. Ignore third-party noise (analytics, challenge scripts).

Keep the session's state clean between scenarios: reload instead of reusing a half-filled form.

### 5. Findings

Whenever the live SUT differs from a test case step, add a `findings[]` entry with the step, what the test case says, what you observed, and a resolution:

- `assert-observed` — same intent, different detail (status code, exact wording): specs assert what the SUT does
- `move-to-ui` / `move-to-api` — the rule exists, but at the other level: the spec for the right level asserts it
- `annotate-gap` — behaviour contradicts an acceptance criterion (a product bug): the spec keeps the assertion the criterion demands and marks the test with `test.fail(true, 'BUG: …')`; it never loosens the assertion

### 6. Write the artifact and run the gate

```bash
npm run runGates -- .agents/manual-to-autotests-pipeline/artifacts/explore-<TICKET>.json
```

Fix every failing gate and re-run. The Cursor stop hook runs the same gate.

### 7. Close the session

```bash
playwright-cli -s=explore-<TICKET> close
```

Report: artifact path, locator count, scenario count, finding count, and any `needsClient: true` API call (a new typed client method is needed before the spec).

## Rules

- Semantic locators only; every `locator` is a real `getBy*` expression you probed.
- `uiLabel` ≠ `tcAction`.
- `apiCalls[].observed` comes from real requests; `pathPattern` is a path (no host).
- Scenarios reference locators and API calls by id; steps are numbered `1..n`.
- Do not write specs, page objects, or fixtures in this stage.
