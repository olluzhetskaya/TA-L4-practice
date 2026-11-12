# ADR 0001: Agentic test-automation pipeline

- Status: accepted
- Date: 2026-11-11
- Deciders: Test Automation leads

## Context

Manual test cases already exist in Jira/Xray. Turning each one into a stable Playwright test is slow, and an unguided LLM does it badly: it invents locators, trusts status codes written in the test case, loosens assertions until they pass, and produces code that violates framework conventions. Test cases are also written ahead of the system, so some of their steps are wrong (a different status code, a rule that only exists in the browser).

We want a pipeline where an agent does the typing and deterministic checks do the judging, so a reviewer only sees work that is already traceable, lint-clean, and green.

## Decision drivers

- Correctness is checked by code, not by reading the agent's explanation.
- Every stage has a machine-readable contract, so stages can be re-run and replaced independently.
- The live system is the source of truth for locators and API behaviour — not the test case, not the agent's memory.
- The fast domain checks run in the agent loop; pre-push and CI share the same complete static-validation command.
- Learners can build it incrementally and know when each stage is done.

## Options considered

1. **One prompt, one pass** ("write a test for this case"). Cheapest; no contracts, no feedback loop, failures show up in review.
2. **Pipeline of skills with deterministic gates between stages** (chosen). More to build; every defect is caught at the stage that causes it.
3. **Record-and-replay / codegen only.** Stable locators but no assertions derived from intent, no API tests, no traceability.

## Decision

We will build a staged pipeline. Each stage is an agent skill that writes one artifact; a hook validates the artifact and sends the agent back with the failures until the gates pass.

| # | Stage | Input | Output | Gate (hook) |
|---|---|---|---|---|
| 1 | Input | Manual test cases (JSON, schema-defined) + optional story (`.md` or `.json`) | `.agents/manual-to-autotests-pipeline/test-cases/<T>.json`, `.agents/manual-to-autotests-pipeline/stories/<T>.md` | Schema, ticket match, AC references resolve, "expected" is concrete, test strategy exists |
| 2 | Analyse SUT (`analyse-sut`) | Stage 1 + `wiki/TEST-STRATEGY.md` + live system | `.agents/manual-to-autotests-pipeline/artifacts/explore-<T>.json`: verified locators, network/API calls with observed results, findings | Schema, test-case references, each UI case has locator evidence, each API case has live call evidence |
| 3 | Specs (`create-api-spec`, `create-ui-spec`) | Stage 2 artifact | Playwright specs + POM / API client / data / fixtures | eslint, ast-grep rules, typecheck; traceability (title = test case title, `testCase('TC-n')`, step naming) and exactly one test per test case |
| 4 | Run | Specs | Green run against the live system | Playwright exit code |
| 5 | Pull request | Branch | PR | Pre-push hook runs `validate` |
| 6 | CI | PR, schedule | Green suite | Same gates + Playwright (api, ui) |

Design rules that apply to every stage:

1. **Contracts are Zod schemas.** The schema is exported to JSON Schema for the agent to read; the gate validates with the same schema.
2. **Gates return `pass | warn | fail`.** Any `fail` makes the stop hook send the failure text back as the agent's next prompt. Only the checks that need pipeline knowledge are custom gates; eslint, ast-grep, tsc and Playwright run natively through npm scripts.
3. **One validator, no skipped steps.** `.agents/manual-to-autotests-pipeline/validate.ts` checks each ticket end to end: valid inputs, an exploration artifact that exists and passes its gates, and a spec for every test case. The Cursor `stop` hook, `npm run validate` (pre-push), and CI use complete mode; stage skills may use progress mode while work is underway.
4. **Findings, not silent deviations.** When the live system differs from a test case step, the artifact records a finding with one resolution (`assert-observed`, `move-to-ui`, `move-to-api`, `annotate-gap`). A product bug keeps its assertion and the test is marked `test.fail(true, 'BUG: …')`.
5. **Layers are fixed by the framework.** Specs call POMs and API clients through fixtures and contain no locators, URLs, or magic values (enforced by ESLint + ast-grep).
6. **Skills are generic; the framework core is specific.** Skills do not name Toolshop endpoints. Anything system-specific lives in the artifact, the strategy, or the data layer.

Hooks and automation:

- `.cursor/hooks.json` → `stop`: run the pipeline validator; failures become a `followup_message` (bounded by `loop_limit`).
- `.githooks/pre-push` (activated by `npm install` through the `prepare` script): run `npm run validate`; a red chain blocks the push. There is no pre-commit hook; CI repeats the same command.
- `.github/workflows/tests.yml`: on pull request, push to `main`, and a weekday schedule — validate, then api and ui projects in parallel with reports as artifacts.

Evals (advanced, optional): a dataset of tickets with golden outputs (a finished Playwright spec per level and the golden artifact). A task stages a workspace, lets the agent write the specs, and grades the output with the same traceability gates plus style, typecheck, anti-shortcut checks and a per-case run. An opt-in LLM judge scores assertion strength per test case (advisory, never decides pass/fail). Only the spec-writing skills are evaluated. The graders are calibrated on the goldens (`npm run eval -- --golden`) before a live run.

## Consequences

- Good: defects are caught where they are introduced; reviewers see traceable, lint-clean, passing code; the same definition of done runs in the agent loop, locally, and in CI.
- Good: wrong test cases are surfaced as findings instead of being papered over.
- Bad: the pipeline needs upkeep — schemas, gates, and rules are code. Mitigated by tests for every gate and rule.
- Bad: the suite depends on a public live system (rate limits, outages, data drift). Mitigated by retries in CI, API-based setup, base URLs overridable by environment variables so a self-hosted copy can replace the public one, and tolerance rules in the strategy.

## How we will know it works

- Each gate has a failing and a passing fixture in the harness tests.
- Golden specs pass all gates and run green; an agent run for the same ticket passes the same gates (eval pass rate).
- A scheduled CI run stays green for a week; a red run is visible in the Actions tab.
