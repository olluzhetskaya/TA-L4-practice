# TA L4 Practice — Build an Agentic Test-Automation Pipeline

You build, from scratch, a harness that turns **manual test cases** into **green Playwright API + UI specs**. The Playwright framework supplies typed clients, page objects, data, and fixtures; Cursor skills sequence the work; deterministic gates validate each output.

```
manual test cases (+ story) ─▶ input gates ─▶ live SUT exploration ─▶ evidence gates
        ─▶ API/UI spec generation ─▶ traceability + tsc + lint + ast-grep ─▶ Playwright ─▶ PR/CI
```

System under test: **Toolshop** — UI <https://practicesoftwaretesting.com>, API <https://api.practicesoftwaretesting.com>, API docs <https://api.practicesoftwaretesting.com/api/documentation> (OpenAPI at `/docs`). Public demo customer: `customer@practicesoftwaretesting.com` / `welcome01`.

## Architecture design approach

The whole design is one bet: an agent is excellent at *producing* text and poor at *judging* its own output — so the agent writes, and deterministic code judges. Each idea below exists to keep that split honest.

- **Deterministic gates.** Every check is code that returns `pass` / `warn` / `fail` the same way every run — reproducible, reviewable, and identical whether you or the agent runs it. "Looks right" is never the bar; a named gate with a message is.
- **A defined output format between phases.** Analysis doesn't hand the spec phase prose — it writes a Zod-schema'd JSON artifact. A machine-checkable contract means the next phase can rely on it, and a mistake is caught at the boundary instead of surfacing three phases later as a mystery.
- **Fail loud and early.** Inputs, artifacts, and specs are each validated at their own boundary. A vague `expected`, an invented status, or a dangling AC reference is rejected where it's introduced, so bad data can't silently propagate.
- **Native tools first, custom code only for domain knowledge.** TypeScript, ESLint, ast-grep and Playwright run directly through npm scripts. The custom domain gates only check relationships those tools cannot know: input validity, live evidence per manual case, traceability, manual-step names, fixture injection, test-data ownership, and exactly-once coverage. `validate.ts` is their single CLI/hook entry point, not another validation framework.
- **Hooks close the loop automatically.** The stop hook feeds failures back to the agent as a to-do; the pre-push hook runs the same `npm run validate` as CI and blocks a red push. The agent self-corrects without a human in the loop to remember to check — the guardrails run whether or not anyone is watching.
- **Grounded in the live system, traceable to a test case.** Assertions trace to behaviour actually observed on the SUT (not assumptions), and every spec maps back to a manual test case — nothing is tested that nobody asked for, and nothing asked for is left untested.

## Tools and instruments

`npm install` installs the project dependencies. Cursor, `playwright-cli`, and `gh` are separate tools.

| Tool | Role in the pipeline |
|---|---|
| **[Node.js](https://nodejs.org) ≥ 22** + **[npm](https://docs.npmjs.com)** | runtime and script runner (every `npm run …` below) |
| **[TypeScript](https://www.typescriptlang.org)** (`tsc`) + **[tsx](https://tsx.is)** | framework and harness code are typed TS; `tsx` runs harness commands directly, with no build step |
| **[Zod](https://zod.dev)** ([repo](https://github.com/colinhacks/zod)) | validates pipeline inputs/artifacts and parses untrusted API/auth responses at runtime |
| **[Playwright](https://playwright.dev)** (`@playwright/test`, [repo](https://github.com/microsoft/playwright)) | the API + UI specs and their fixtures; `playwright test` runs them |
| **[playwright-cli](https://github.com/microsoft/playwright-cli)** | drive a live browser session to explore the SUT in Phase 2 |
| **[ESLint](https://eslint.org)** (+ [`typescript-eslint`](https://typescript-eslint.io), [`eslint-plugin-playwright`](https://github.com/playwright-community/eslint-plugin-playwright), [`eslint-plugin-sonarjs`](https://github.com/SonarSource/SonarJS/blob/master/packages/analysis/src/jsts/rules/README.md)) | enforce the coding conventions; run as a gate |
| **[ast-grep](https://ast-grep.github.io)** (`@ast-grep/cli`, [repo](https://github.com/ast-grep/ast-grep)) | structural lint rules the agent must obey (Phase 4) |
| **[openapi-typescript](https://openapi-ts.dev)** ([repo](https://github.com/openapi-ts/openapi-typescript)) | generates compile-time API models; `ContactRequest` is derived from them and consumed by the typed client (`npm run generate:types`) |
| **[node:test](https://nodejs.org/api/test.html)** | unit tests for the core harness (`npm run test:harness`) and optional eval tooling (`npm run test:eval`) |
| **[`@cursor/sdk`](https://www.npmjs.com/package/@cursor/sdk)** | runs a real agent unattended for the advanced evals (Phase 8); needs `CURSOR_API_KEY` |
| **[Agent Skills](https://agentskills.io/home)** (`.agents/skills/<name>/SKILL.md`) | the agent's recipes, in the open [Agent Skills](https://agentskills.io/home) format: a folder with a `SKILL.md` (name + description + instructions) that the agent loads only when a task matches. **Tool-agnostic**: any skills-compatible agent can use them; Cursor finds them through the `.cursor/skills` symlink to `.agents/skills`, another tool needs its own symlink or path |
| **Cursor project rules** (`.cursor/rules/*.mdc`) | file-scoped layer contracts loaded automatically while the agent edits data, fixtures, page objects, API clients, or specs |
| **[Cursor](https://cursor.com) agent and [hooks](https://cursor.com/docs/hooks)** | the agent follows the skills and writes code; Cursor's native `stop` event invokes the fast domain validator and can send failures back as a follow-up |
| **[git hooks](https://git-scm.com/docs/githooks)** (`git config core.hooksPath`, set by `npm install`) | the pre-push check for every contributor, not just the agent |
| **[git](https://git-scm.com)** + **[GitHub Actions](https://docs.github.com/actions)** + **[`gh` CLI](https://cli.github.com)** | version control, CI that keeps it green (Phase 7), and opening the PR (Phase 6) |

## How to use this repo

This repo is a complete worked example with two distinct parts:

- the Playwright framework in `src/` and `tests/`: config, generated OpenAPI types, typed API clients, data builders/runtime schemas, page objects, global authentication setup, and dependency-injection fixtures;
- the automation harness in `.agents/`: skills, schemas, domain gates, hook integration, and optional evals.

The course builds the harness around the supplied framework and `TOOL-1` inputs. The finished repository is a reference implementation rather than a blank starter.

Run `npm install && npx playwright install chromium`. Copy `.env.example` to `.env`.

In normal use, ask Cursor to automate the supplied manual test JSON and story. `AGENTS.md` supplies the always-on conventions, matching `.cursor/rules/` add file-scoped layer contracts, and the `automate-test-case` skill sequences live exploration and spec generation. When the agent tries to finish, Cursor's native `stop` event runs the fast domain validator in complete mode; `validate.ts --hook` only formats project-specific failures as a follow-up. The generation skills run targeted lint and Playwright commands, while pre-push and CI run the authoritative `npm run validate`.

Each phase below has the same shape: **Why** (what goes wrong without it), **Example** (a concrete before/after), **Build** (what to create), **Acceptance** (a command that must pass before you move on).

## What you are given

Think of the repo in two layers: the **starting point** you are handed, and the **finished pipeline** you build phase by phase. The second table is a map of every part of the finished one. Open it when you reach that phase, or later when you adopt a piece in your own project.

### The starting point

| Given | Where |
|---|---|
| Story + manual test cases for `TOOL-1` (contact form); the test cases are a Jira/Xray export | `.agents/manual-to-autotests-pipeline/stories/TOOL-1.md`, `.../test-cases/TOOL-1.json` |
| Test strategy the agent must follow. `wiki/` is the project's context folder: the agent reads it before it works, so put anything it should know there (domain glossary, environments, naming rules, known bugs, architecture notes) next to the strategy | `wiki/TEST-STRATEGY.md` |
| Playwright framework the generated specs use: environment/timeouts, generated OpenAPI types, `BaseApi` + composed `ToolshopApi` clients, Zod `readJson`, data builders/enums/schemas, `BasePage` + `ContactPage`, global customer login, fixture injection, tags, and API/UI projects | `src/`, `tests/fixtures/`, `tests/global.setup.ts`, `playwright.config.ts` |
| Supporting [Agent Skills](https://agentskills.io/home) the spec skills delegate to: `playwright-cli`, `probe-sut`, `create-locators`, `pom-builder`, `data-layer`, `test-data-state-management`, `test-stability`, `playwright-annotations`, `typescript-types`, `architecture-best-practices`, `code-review`, `github-ci` | `.agents/skills/` |
| Agent contract and native enforcement: always-on conventions, file-scoped layer rules, `tsc` for types, ESLint for imports/Playwright rules, and ast-grep for code shapes | `AGENTS.md`, `.cursor/rules/`, `tsconfig.json`, `eslint.config.mjs`, `tools/ast-grep/rules/` |

### The finished pipeline (what you build)

Custom code is kept to what native tools cannot know. Everything else is an npm script over TypeScript, ESLint, ast-grep and Playwright.

| Part | What it is | Where | Phase |
|---|---|---|---|
| Design record | the decision, the rejected options, the stage table | `docs/adr/` | 0 |
| Gate result | `pass` / `warn` / `fail` and the Zod helper | `.agents/lib/gateResults.ts` | 1 |
| Harness config | paths, timeouts, file patterns, eval protected files | `.agents/harness-config.ts` | 1 |
| Pipeline validator | per ticket: inputs, exploration artifact, specs. One entry for the stop hook, the CLI and CI (`npm run validate:pipeline`) | `.agents/manual-to-autotests-pipeline/validate.ts` | 1 |
| Input gates | test case and story schemas + gates | `.agents/manual-to-autotests-pipeline/input-validation/` | 1 |
| Entry skill | sequences input, live exploration, API/UI generation, and verification for one natural prompt | `.agents/skills/automate-test-case/` | 1 |
| Analyse skill | the recipe the agent follows | `.agents/skills/analyse-sut/` | 2 |
| Exploration gates | the artifact schema and five exploration gates | `.agents/manual-to-autotests-pipeline/exploration-validation/` | 2 |
| Spec skills | `create-api-spec`, `create-ui-spec` | `.agents/skills/create-*-spec/` | 3 |
| File-scoped rules | data, fixture, POM, API-client, and spec contracts loaded for matching files | `.cursor/rules/` | 3 |
| Spec gates | title/ID/level traceability, required manual-action steps, fixture injection, test-data ownership, and one test per test case | `.agents/manual-to-autotests-pipeline/specs-validation/` | 3 |
| Static rules | TypeScript + ESLint + ast-grep, including the spec import boundary and Playwright code shapes | `tsconfig.json`, `eslint.config.mjs`, `tools/ast-grep/` | 4 |
| Hooks | Cursor `stop` hook, git pre-push | `.cursor/hooks.json`, `.githooks/` | 5 |
| Specs | the generated API and UI specs for `TOOL-1` | `tests/api/`, `tests/ui/` | 6 |
| CI | `npm run validate`, then the api/ui matrix, with reports | `.github/workflows/tests.yml` | 7 |
| Advanced eval (optional) | reusable eval engine plus a spec dataset, workspace builder, deterministic graders, opt-in LLM judge, and one CLI | `.agents/lib/eval/`, `.agents/manual-to-autotests-pipeline/eval/`, `scripts/run-eval.ts` | 8 |
| Harness tests | `node:test` for core gates and rules (`npm run test:harness`); eval tests are separate (`npm run test:eval`) | `*.test.ts` under `.agents/` | all |

The full folder map is under [Layout](#layout).

## Phase 0 — ADR

**Why.** An agent pipeline has many moving parts (stages, artifacts, gates, hooks). Without a written design, each part gets decided ad hoc while coding, and nobody can say later why a gate exists or what is deliberately left out. Writing the decision down first is also the cheapest place to discover a bad idea.

**Example.** The ADR in this repo weighs three options and rejects two, with a reason each:
- *Ungated one-pass generation* ("write a test for this case") — cheapest, but there are no contracts and no feedback loop, so failures only show up in review. The finished `automate-test-case` entry skill still accepts one natural prompt, but sequences the gated stages behind it.
- *Record-and-replay / codegen only* — stable locators, but no assertions derived from intent, no API tests, no traceability.
- *Pipeline of skills with deterministic gates between stages* (chosen) — more to build, but every defect is caught at the stage that causes it.

**Build.** Copy `docs/adr/TEMPLATE.md` to `docs/adr/0001-agentic-test-automation-pipeline.md` and decide, before writing code: stages, artifacts and their formats, what each gate checks, who owns what, what is out of scope, how you will know it works. Name at least two rejected options.

> **Think first.** Before you open the template: which stages would you have, and what would you refuse to automate? What would make you trust the pipeline's output without reading it? An ADR that answers these in a page is better than a long one.

*Acceptance:* a reviewer can implement the pipeline from the ADR alone.

## Phase 1 — Input and input hook

**Why.** Everything downstream trusts the test cases. A vague expected result cannot become an assertion, and a dangling requirement link means a test nobody can trace. Catching this at the door costs one failing command; catching it after the spec is written costs a rewrite.

**Example.** The input is what Jira and [Xray](https://docs.getxray.app/space/XRAY/301474262/Tests+-+REST) give you: one Jira issue of type *Test* per manual test case, exported with a search, refined or annotated by humans or agents:

```json
{
  "key": "TC-1",
  "fields": {
    "issuetype": { "name": "Test" },
    "summary": "Verify that the contact API rejects invalid messages and accepts a boundary-length message",
    "priority": { "name": "High" },
    "components": [{ "name": "api" }],
    "labels": ["AC-4", "AC-5", "AC-6", "AC-2"],
    "issuelinks": [
      { "type": { "name": "Test" }, "outwardIssue": { "key": "TOOL-1" } },
      { "type": { "name": "Precondition" }, "inwardIssue": { "key": "PRE-1", "fields": { "summary": "The contact endpoint POST /messages is reachable without authentication" } } }
    ],
    "customfield_10004": {
      "steps": [
        {
          "index": 3,
          "fields": {
            "action": "Send a contact message of 251 characters",
            "data": "message: 251 x 'x'",
            "expected result": "HTTP 422; the validation error names the message field"
          }
        }
      ]
    }
  }
}
```

Now compare two versions of one step's expected result:

```json
{ "action": "Send a message", "data": "invalid message", "expected result": "not work" }
```

```json
{
  "action": "Send a contact message of 251 characters",
  "data": "message: 251 x 'x'",
  "expected result": "HTTP 422; the validation error names the message field"
}
```

The first cannot be turned into an assertion: what does "not work" check? The second names the status and the field, so the spec practically writes itself. A gate should tell the two apart.

A person or the agent may refine it (sharpen a vague `expected result`, add a missing precondition, split a case). The input schema and gates run on every change through the stop hook, so whatever edits the file, the Jira/Xray shape and the rules above stay enforced.

> **Think first.** You are handed a manual test case file. Before you read our list: what would you check, so that nothing downstream has to guess? Write down your own list, then compare it with the one below. What would you add?

| Question to ask of the input | Our gate | A failure looks like |
|---|---|---|
| Is the file shaped like a Jira/Xray test export at all (key, summary, component, steps, expected result)? | `schema` | `issues.0.fields.components: Invalid input: expected array` |
| Does the file belong to the story its name says (every test links to one story, and the same one)? | `ticket-match`, schema | `file name says TOOL-2 but "ticket" is TOOL-1` |
| Does every requirement link point to something real? | `ac-refs` | `acRefs not found in the story: TC-1 → AC-9` |
| Can every expected result become an assertion? | `concrete-expected` | `expected result is too vague to assert on: TC-2 step 3` |
| Are ids and titles unique (one title ↔ one test)? | schema refinement | `duplicate id TC-1` |
| Is there a story to trace against? (optional) | `story` | warn, not fail: `no story found` |
| Do the cases cover both levels the strategy asks for? | `level-coverage` | warn: `only api test cases` |
| Is the strategy the agent must follow present? | `strategy` | `wiki/TEST-STRATEGY.md is missing` |

Ideas we did not build, if you want a harder version: an API step whose `expected result` names no status code; a UI step whose `data` names a field the story never mentions; a test case with no precondition when the steps need an authenticated user.

This is also where the harness is born. You can't check anything without a way to express a result and a way to run it, so build the minimal core here and immediately point it at `TOOL-1.json`. Later phases grow it next to the first thing that needs each piece, with no big framework up front.

**Build** three things, in this order. Files in this repo are in brackets.

1. **One validator.** A command that takes a ticket, runs its checks, prints each result and exits non-zero if one failed. It is the one entry point the hook, CI and you will all call. (`.agents/manual-to-autotests-pipeline/validate.ts`, with the result type in `.agents/lib/gateResults.ts`)
2. **Concrete input validation checks.** The schema for the test case file and the gates from the table above, as a function that takes a ticket and returns its results. (`.agents/manual-to-autotests-pipeline/input-validation/`)
3. **One place for shared facts:** directories, file patterns and timeouts, so no check hard-codes a path. (`.agents/harness-config.ts`)

Run the validator by hand and by npm script (`npm run validate:pipeline`); you wire it to the agent's `stop` event and to git in Phase 5. A validator that works from the command line is what makes that wiring trivial. Build it with only the input checks and point it at `TOOL-1` before you write more. The whole idea fits on one screen:

```ts
type GateResult = { gate: string; status: 'pass' | 'warn' | 'fail'; detail?: string }   // one vocabulary for every check
const hasFailure = (gates: GateResult[]) => gates.some(g => g.status === 'fail')

function validateTicket(root: string, ticket: string): GateResult[] {
  const input = reviewInput(root, ticket)                    // Phase 1: schema, story, AC links, concrete expected
  return input.gates                                         // Phase 2 and 3 append the artifact and spec gates here
}

for (const ticket of ticketsOf(process.cwd())) {
  const gates = validateTicket(process.cwd(), ticket)
  for (const g of gates) out(`${ICON[g.status]} ${g.gate} ${g.detail ?? ''}`)              // the agent reads this output
  failed ||= hasFailure(gates)                                                             // any fail blocks
}
process.exit(failed ? 1 : 0)                                                               // the exit code is what hooks and CI act on
```

Why it is one function per ticket and not a plugin registry: the three phases always run in the same order on the same ticket, so adding a phase is adding a few lines. The real validator also has a `--hook` mode (Phase 5) that turns failures into a follow-up message for the agent, and a `--progress` mode that only demands what the work so far implies (an artifact once a spec exists), while the default demands everything.

Make the schema reject bad data itself, so the gates have less to do. A few lines carry most of the idea:

```ts
const xrayTestSchema = z.object({
  key: z.string().regex(TC_ID_PATTERN, 'key must look like TC-1'),              // shape, not just "a string"
  fields: z.object({
    issuetype: z.object({ name: z.literal('Test') }),                         // only Test issues, not Bugs or Stories
    components: z.tuple([z.object({ name: testLevelSchema })]),               // exactly one level; "apiiii" fails here
    priority: z.object({ name: z.enum(['Highest', 'High', 'Medium', 'Low', 'Lowest']) }),
    description: z.string().nullable(),                                       // "no notes" is an explicit null
    [MANUAL_STEPS_FIELD]: z.object({ steps: z.array(xrayStepSchema).min(1) }), // a test case without steps is not one
  }),
})

export const testCaseFileSchema = xrayExportSchema
  .transform(({ issues }) => ({ ticket: storyKey(issues), testCases: issues.map(toManualTestCase) }))
  .pipe(normalisedFileSchema)        // parse the export, then validate the flat shape the gates read
```

The conventions behind it: fixed sets are `z.enum`; non-empty strings and id patterns are `.min(1)` / `.regex`; optional means *explicitly* optional; `.nullable()` is for "genuinely unknown" so the agent never has to invent a value; types come from `z.infer`, never a hand-written copy; parse with `safeParse`, never a cast or `any`. You can also consider `.strict()` objects so a typo'd key is an error instead of being dropped.

`npm run schema:update` exports the Zod schemas as JSON Schema (`*.schema.json`), so editors and the agent can read the contract without running code. `npm run schema:check` (part of `validate`) fails when a committed file is stale; validation never rewrites files.

*Acceptance:* `npm run validate:pipeline -- --progress TOOL-1` passes. A copy with a vague `expected result` or an unknown `AC-9` fails with a message an agent can act on. Write a passing and a failing fixture per gate (`node:test`).

## Phase 2 — Analyse the SUT

**Why.** The test cases describe what someone *expects* the system to do. The agent that types the specs from them alone will assert the wrong status code and click a label that doesn't exist. A separate analysis step looks at the real system first and writes down what is true, so the spec phase builds on observations instead of assumptions — and when the two disagree, the disagreement is recorded as a finding instead of becoming a flaky test.

**Example.** The test case says "fill in *Email*" and "expect HTTP 201". The live page's field is labelled *Email address*, and the API answers `200` with the record. The artifact records the real label as the locator, the observed `200` as the response, and a finding `assert-observed` that explains the difference. The spec then asserts `200`.

**Build** the analysis as a skill plus its checks: the **recipe** the agent follows (`.agents/skills/analyse-sut/SKILL.md`), the **schema** of the artifact it must write (`exploration-validation/schema.ts`, exported to JSON Schema for the agent to read), and one **gate per failure mode** (`exploration-validation/gates.ts`). The validator runs them whenever an artifact exists, and **fails when it does not** — a spec without an exploration cannot pass.

The artifact `.agents/manual-to-autotests-pipeline/artifacts/explore-<TICKET>.json` is the contract between analysis and implementation. It must hold:

- **locators** — semantic (`getByRole`, `getByLabel`, …), probed on the live page, linked to a test case step; the rendered label differs from the test case wording
- **apiCalls** — method, path, auth, request/response fields, and **live observations** (status + body for each case fired)
- **findings** — where the live system differs from the test case, each with one resolution: `assert-observed`, `move-to-ui`, `move-to-api`, `annotate-gap` (a product bug: the spec keeps the expected behaviour and is marked `test.fail`)

Skill steps: read strategy → resolve auth → walk the UI with `playwright-cli` in a named session → capture network → fire pre-flight API requests → write the artifact → run `npm run validate:pipeline -- --progress <TICKET>` until it passes.

> **Think first.** The artifact is written by an agent, and an agent can fill a JSON file with plausible nonsense. What would you check mechanically so that a made-up locator, an unobserved API call or a forgotten test case can't get through? Give each failure mode its own gate, so the message tells the agent exactly what to fix.

| What could be wrong | Gate catches it by | Mutation that must fail it |
|---|---|---|
| the file is not the contract | schema validation | delete `apiCalls` |
| the locator is a guess | semantic `getBy*` only; no CSS, XPath or `TODO` placeholders | `"locator": "div.form > input:nth-child(2)"` |
| evidence points at an unknown test case | every locator, call, and finding has a valid `tcRef` | locator refers to `TC-99` |
| a test case was skipped | each UI case has a locator and each API case has a live call | remove the evidence for `TC-2` |
| the API call was never really made | at least one live observation per call | an `apiCall` with `observed: []` |

*Acceptance:* a hand-made reference for `TOOL-1` passes your gates; mutated copies (placeholder locator, unknown test-case reference, missing locator/API evidence for a case, API call without observations) each fail a *different* named gate. Then run the skill on `TOOL-1` and get an artifact that passes.

## Phase 3 — Spec skills and spec gates

**Why.** A skill is the recipe that makes the agent's output consistent from run to run; the gates are what makes it *checkable*. Without traceability gates, an agent can write plausible tests that map to no manual test case (scope creep) or skip one (silent gap).

**Example.** The agent writes `test('contact form works', …)` with no annotation. The `tc-trace` gate fails: `"contact form works" is not a test case title in TOOL-1`. After the fix the test is titled `Verify that a visitor can send a message through the contact form` (the manual title, verbatim) and carries `annotation: testCase('TC-3')`, which links it back to the manual test case.

**Build** two recipes, one for API specs and one for UI specs (`.agents/skills/create-api-spec/`, `.agents/skills/create-ui-spec/`), and the spec gates that check what they produce (`.agents/manual-to-autotests-pipeline/specs-validation/`).

### Define the agent contract before generating code

The goal is correct code on the first run, not code that becomes correct only after lint repeatedly rejects it. Define guidance at three activation levels:

- **Always on — `AGENTS.md`:** repository-wide safety rules, layer direction, imports, typing, and test conventions that apply to every task.
- **File scoped — `.cursor/rules/*.mdc`:** detailed contracts activated by matching files. Rules deliberately overlap: while editing a spec, the data and fixture rules also load; UI specs additionally load the POM rule, and API specs load the API-client rule.
- **On demand — `.agents/skills/*/SKILL.md`:** procedural workflows such as analysing the SUT, creating an API/UI spec, choosing locators, building a page object, or managing test state.

Other coding agents provide analogous instruction layers: Claude Code uses `CLAUDE.md` and `.claude/rules/`; GitHub Copilot uses `.github/copilot-instructions.md` and path-scoped `.github/instructions/*.instructions.md`. Adapt the same contracts to the supported format of the agent used by the project.

The automation engineer must define these conventions for the real project before asking the agent to generate tests. Adapt the supplied examples to the project's architecture, naming, data ownership, fixture model, and quality bar; do not copy rules or skills that describe a different framework. Keep them current when the framework changes.

Keep each fact at the narrowest useful level: universal policy in `AGENTS.md`, layer contracts in project rules, and multi-step instructions in skills. ESLint, ast-grep, TypeScript, pipeline gates, and Playwright are the second phase—a deterministic safety net and feedback loop, not the primary source of coding instructions.

The TypeScript compiler API reads each spec, so an annotation belongs to its own test rather than to a nearby string or comment.

Checks shared by the normal pipeline and eval:

- **Spec gates:** exact manual title and `TC-n`; API/UI level matches the file; every test uses a manual-action `test.step`; raw `page`/`request` fixtures are rejected; every manual case has exactly one test.
- **Test-data gate:** payload and expected-value literals must come from fixture-exported data, responses, or schemas. Focused static rules own status, wait, timeout, locator, and navigation literals so the general gate does not report them twice. The remaining strict check can still false-positive when a literal is genuinely part of the behaviour.
- **TypeScript:** imports, fixture types, payloads, clients, and assertions compile.
- **ESLint:** specs import only `@fixtures`; Playwright rules and TypeScript conventions pass.
- **ast-grep:** locators, navigation, and request calls are rejected in specs; steps cannot be empty; assertions have messages; status codes, waits, URLs, and timeouts are not inline.
- **Playwright:** generated specs execute against the configured SUT.

API contract checks:

- **OpenAPI types:** compile-time payload and client contracts.
- **Zod + `readJson`:** runtime response shape from the live server.

Eval-only checks:

- **Golden parity:** expected statuses and assertion matcher strength. The normal pipeline has no golden answer.
- **Anti-shortcut:** no disabled tests, inappropriate `test.fail`, or edits to protected inputs/config.
- **LLM judge (advisory):** expected-result assertion quality. It can false-positive and never decides task pass/fail.

Skills are generic: no Toolshop endpoints inside. Keep them short by **delegating** to the supporting skills (each step names the skill to read) instead of repeating their rules. They must say how to map each finding to an assertion, reuse before creating, where data/POM/fixtures live, and how to verify (`validate:pipeline`, `playwright test`).

What a traceable test looks like (from `tests/ui/TOOL-1.contact.ui.spec.ts`):

```ts
test(
  'Verify that a visitor can send a message through the contact form',      // title = the manual title, verbatim
  { tag: [Tag.Ui, Tag.Smoke, Tag.Regression], annotation: testCase('TC-3') }, // link back to the manual test case
  async ({ contactPage }) => {
    await test.step('Confirm that send the form', async () => {  // prefix + manual action wording
      await contactPage.submit()
      await expect(contactPage.getAlert(ContactCopy.confirmation), 'Confirmation should replace the form').toBeVisible()
    })
  },
)
```

> **Think first.** If the agent writes the specs, how do you know it wrote *the* specs: all of them, and only them? List what you would verify about the file before running it. Ours: title = test case title · `testCase('TC-n')` annotation per test and it matches the title · test level matches the file name (`*.api.spec.ts` holds `api` cases) · step names start `Verify that` / `Confirm that` · every test case is covered exactly once.

*Acceptance:* `npm run test:harness` covers each gate. Running the skills on `TOOL-1` produces `tests/api/TOOL-1.*.api.spec.ts` and `tests/ui/TOOL-1.*.ui.spec.ts` that pass the hook.

## Phase 4 — Lint and ast-grep rules

**Why.** Style rules written in a prompt are suggestions the agent forgets under pressure. A rule that fails the build is a fact. ESLint covers what the type system can see; ast-grep covers code *shapes* (a call with a literal argument, a method chain) that are awkward to express in ESLint.

**Example.** A spec contains `await page.goto('/contact')` and `expect(response.status()).toBe(200)`. `no-goto-in-spec` points at the first line (navigation belongs in a page object) and `no-status-literal-in-assert` at the second (use `HttpStatus.OK`). The agent fixes both from the message; nobody reviews it by hand.

**Build** the rules the agent must obey. ESLint is configured; write ast-grep rules in `tools/ast-grep/rules/`, each with a bad and a good fixture.

A rule is a pattern, a message and the files it applies to. This one is all of `no-goto-in-spec.yml`:

```yaml
id: no-goto-in-spec
message: "`page.goto` in a spec bypasses page-object navigation. Call the page object's `open()` instead."
severity: error
language: TypeScript
files: [tests/**/*.spec.ts]
rule:
  any:
    - pattern: page.goto($URL)
    - pattern: page.goto($URL, $$$)
```

The message is written for the agent: it names the problem *and* the replacement.

> **Think first.** Open `AGENTS.md` and pick five conventions. For each, decide: can a tool see the violation, and which tool? Our split: a rule about *what a call looks like* is ast-grep; a rule about *types or imports* is ESLint. Some conventions need a human (is this comment necessary?), so stay honest about what you automate.

Pairs to learn from:

| Rule | Rejected | Accepted |
|---|---|---|
| `no-goto-in-spec` — navigation belongs in page objects | `await page.goto('/contact')` | `await contactPage.open()` |
| `no-page-locator-in-spec` — locators belong in page objects | `page.getByRole('button', { name: 'Send' })` in a spec | `contactPage.getSendButton()` |
| `no-status-literal-in-assert` — enums own the numbers | `expect(res.status(), 'm').toBe(422)` | `.toBe(HttpStatus.UNPROCESSABLE_ENTITY)` |
| `expect-needs-message` — a failure must explain itself | `expect(rows).toHaveCount(3)` | `expect(rows, 'Table should show 3 rows').toHaveCount(3)` |
| `no-manual-sleep` — no fixed waits | `await page.waitForTimeout(2000)` | `await expect(alert).toBeVisible()` |
| `no-nth-zero`, `no-then-in-async-code`, `no-inline-magic-timeout` — stability | `locator.nth(0)`, `.then(…)`, `{ timeout: 5000 }` | a precise locator, `await`, a named constant |
| `no-request-context-outside-api-helper` — layering | `request.post(...)` in a spec | `toolshopApi.contact.send(...)` |
| ESLint + spec gates — dependency injection | direct `@data/*` import or `async ({ page })` | import from `@fixtures`; inject `contactPage` / `toolshopApi` |
| spec gates + `no-empty-test-step` — readable reports | no `test.step`, or an empty one | `await test.step('Verify that …', …)` |

Fix lint errors, never suppress them (`eslint-disable` is itself an error).

*Acceptance:* `npm run ast-grep` and `npm run lint` pass on clean code. The ast-grep rule tests exercise rejected and accepted code shapes; ESLint owns the `@fixtures`-only spec import boundary.

## Phase 5 — Wire the hooks

**Why.** Gates that only run when someone remembers to run them protect nothing. Hooks make the checks part of the workflow: the agent is corrected the moment it finishes a turn, and a red push can't leave the machine.

**Example.** The agent renames a test title and says "done". The stop hook runs, the `tc-trace` gate fails, and the agent receives a follow-up message: *`"Sends a message"` is not a test case title in TOOL-1*. You did not type anything. If it had left a `page.waitForTimeout(2000)` instead, the `no-manual-sleep` rule would stop the push.

> **Think first.** Which check should run when? Slow checks on every keystroke get disabled; fast ones on every turn get ignored if they are noisy. Decide what runs after an agent turn, what on commit and what on push, and why. Our split: the pipeline validator after a turn (milliseconds), everything on push, and the same command again in CI. We dropped a pre-commit hook: it ran the same checks as pre-push, only more often.

**Build** `.cursor/hooks.json` and a pre-push git hook. `npm install` activates the git hooks through the `prepare` script (`git config core.hooksPath .githooks`); no extra tool is needed. The whole agent hook is this:

```json
{
  "version": 1,
  "hooks": {
    "stop": [{ "command": "node --import tsx .agents/manual-to-autotests-pipeline/validate.ts --hook", "loop_limit": 3 }]
  }
}
```

`loop_limit` caps how many times the agent is sent back, so a gate it cannot satisfy ends the loop instead of running forever.

> **Note — agent hooks are tool-specific, not tool-agnostic.** The `stop` hook here uses Cursor's `.cursor/hooks.json`. If you build the same pipeline with a different agent, the wiring changes: Claude Code uses `.claude/settings.json`, other tools have their own conventions. The *concept* (run gates after every turn, bounce failures back) is portable; the config file and event names are not.

- **`.cursor/hooks.json` — Cursor agent hook:** `stop` → `validate.ts --hook` — runs complete pipeline validation after every agent turn (inputs, artifact, specs; no lint); failures come back as a follow-up message (set a `loop_limit`).
- **`.githooks/pre-push` — git hook:** `npm run validate` (schema check + typecheck + eslint + ast-grep + pipeline validator + harness tests) on every push — the authoritative gate before anything leaves the machine. CI runs the same command.

*Acceptance:* rename a spec title — the agent is sent back to fix it without you saying anything. Add a stray `page.waitForTimeout` and try `git push` — it is blocked with the reason.

## Phase 6 — Run, then open a PR

**Why.** Static gates prove the code is well-formed, not that it works. Specs have to run against the live system, and live systems are slow and sometimes briefly wrong — so flakiness is fixed with auto-retrying assertions, not sleeps, which only hide the race.

**Example.** A UI test clicks *Send* and immediately reads the confirmation: green on a fast run, red on a slow one. The fix is `await expect(contactPage.confirmation, 'Confirm that …').toBeVisible()`, which retries until the message appears, not `waitForTimeout(1000)`.

Run the generated specs (`npm run test:api`, `npm run test:ui`). Then:

```bash
npm run validate               # schemas + typecheck + lint + ast-grep + pipeline validator + harness tests
git checkout -b feature/TOOL-1-contact
git add -A && git commit -m "TOOL-1: contact form API and UI specs"
gh pr create --fill
```

*Acceptance:* the PR has green checks; every spec title maps to a test case.

## Phase 7 — CI that keeps it green

**Why.** A suite that was green on your machine on Tuesday says nothing about Friday. CI re-runs everything on every change, and a *scheduled* run catches the case that matters most for a suite on a live system: nobody touched the code, but the system changed. (An alert job that opens an issue on a red scheduled run is a natural next step; it is left out here to keep the workflow small.)

**Example.** The nightly run fails because the SUT changed a validation message. The run goes red in the Actions tab and its HTML report is attached, so you can see which assertion broke and open the trace.

**Build** `.github/workflows/tests.yml`: triggers on `pull_request`, `push` to `main`, a weekday `schedule`, and `workflow_dispatch`. Jobs: **validate** (`npm ci`, `npm run validate`, the same command as the pre-push hook) → **playwright** matrix `api`/`ui` (install browsers only for ui, `CI=true`, upload the HTML report always). Evals are not in CI: they call a paid agent and are slow, so they run on demand.

*Acceptance:* a PR with a deliberately broken assertion goes red and its report is downloadable; a manual `workflow_dispatch` run is green.

## Phase 8 (advanced) — Evals

Skip this on a first pass: the core pipeline is complete after Phase 7. Evals are a separate, advanced exercise, and they only grade the spec-writing skills. It teaches both kinds of grader: deterministic checks first, then an LLM judge for what is left. The judge is built and unit-tested but costs tokens, so it only runs when you pass `--judge`.

### Why

Gates tell you whether *one* output is acceptable. They don't tell you whether the **skill** is good: change a sentence in `create-api-spec/SKILL.md` and you can't know if the agent now writes better specs, worse ones, or the same. An eval is a repeatable experiment: the same input every time, an agent run unattended, and a result computed by code. It turns "I think the skill got better" into "4/4 tasks passed before, 3/4 now".

### The shape of an eval

| Part | What it is here | Where |
|---|---|---|
| **Runner library** | run an agent task, execute command gates, build/parse judge verdicts, and parse annotated Playwright reports | `.agents/lib/eval/` |
| **Dataset** | this pipeline's tickets with fixed inputs and a stored *golden* answer | `.agents/manual-to-autotests-pipeline/eval/dataset/` |
| **Spec task** | stage this pipeline's workspace, build its prompt, grade it, and clean up | `.agents/manual-to-autotests-pipeline/eval/spec-task.ts`, `workspace.ts` |
| **Grader** | apply shared spec gates and this pipeline's golden/protected-file checks | `.agents/manual-to-autotests-pipeline/eval/grade.ts`, `spec-checks.ts` |
| **Judge** (opt-in) | reusable prompt/parsing plus this pipeline's test-case rubric; advisory | `.agents/lib/eval/judge.ts`, `.agents/manual-to-autotests-pipeline/eval/judge.ts` |

Reusable eval mechanics live under `.agents/lib/eval/`; they know nothing about tickets, manual-test schemas, or this pipeline's annotation name. The concrete dataset, workspace, spec task, graders, rubric, and `'test-case'` annotation convention live under `.agents/manual-to-autotests-pipeline/eval/`. The example deliberately evaluates only spec creation: each task receives fixed test cases, story, and exploration evidence, then asks the agent naturally to write the spec in a disposable workspace. This isolates the skill being measured and prevents live-system drift from changing the input.

The teaching pattern is:

1. Run cheap, reproducible checks first. These decide whether the task passed.
2. Ask an LLM judge only the quality question code cannot answer reliably.
3. Keep the judge advisory because its answer is not deterministic.

### What to check

The eval first runs the shared spec checklist from Phase 3. It then adds:

- `no-disabled-tests`: reject `skip`, `fixme`, and `only`;
- `bug-marking`: require `test.fail` only for cases with an `annotate-gap` finding;
- `parity:statuses`: require the statuses asserted by the golden;
- `parity:assertions`: require at least the golden's assertion matcher strength;
- `protected-files`: reject edits to task inputs, config, tools, and harness;
- `run:TC-n` (unless `--no-run`): execute each generated case;
- `judge:TC-n` with `--judge`: advisory expected-result assertion review.

Golden comparisons ignore helper names and file layout, so a different valid implementation can pass.

### What needs a judge

Some questions have no deterministic answer: *does this assertion really verify the expected result?* A test can have the right title, the right annotation, a `200` check and a green run, and still not look at the response body the test case cares about.

That is the one job of the optional LLM judge. The reusable library builds and parses the judge exchange; the concrete `.agents/manual-to-autotests-pipeline/eval/judge.ts` builds one criterion per test case from the manual steps:

```
judge:TC-2  The test verifies each expected result with an assertion that would fail
            if that behaviour were wrong.
            1. Send a 251-character message -> HTTP 422; error names the message field
```

A status-only test should fail this criterion because it never verifies the field-level error. The judge sees the manual cases, generated spec, and golden spec as one valid reference. Its prompt explicitly excludes style, naming, annotations, compilation, and execution because deterministic tools already cover them.

The judge returns `{ id, pass, reason }` verdicts reported as `judge:TC-n`. They never change the task's pass/fail result. Calibrate the judge against the golden outputs before reading its feedback. Rule of thumb: if a check can be code, make it code; use the judge only for the remainder.

### Run the example

Each dataset item contains fixed test cases, story, exploration artifact, and golden output. The reusable `runEvalTask` owns the task lifecycle; concrete `spec-task.ts` supplies the workspace, prompt, grader, and optional judge callbacks. `scripts/run-eval.ts` exposes two modes:

| Command | Does |
|---|---|
| `npm run eval -- --golden --no-run` | grade stored golden outputs without an API key; proves the deterministic grader accepts known-good work |
| `npm run eval -- --golden --no-run --verbose` | print every deterministic gate instead of only failed gates |
| `npm run eval -- TOOL-2 --level=api --no-run` | run one live spec-generation task and grade it; requires `CURSOR_API_KEY` |
| `npm run eval -- --golden --no-run --judge --verbose` | print every advisory judge criterion too; requires `CURSOR_API_KEY` and optionally `CURSOR_JUDGE_MODEL` |

Run `npm run test:eval` first, then calibrate with `--golden`. If a golden fails, fix the grader or fixture before evaluating an agent. Omit `--no-run` when the eval should also execute Playwright.

### Reading the result

```
ok   TOOL-1 api
FAIL TOOL-2 api
       protected-files: playwright.config.ts was modified
       run:TC-2: Expected 422 …

tasks passed: 3/4
judge criteria passed (advisory): 7/9   <- only with --judge
```

A task passes only when its deterministic gates pass. Judge failures are printed separately and never change `tasks passed`. Read the named failures rather than treating one small-sample percentage as a benchmark; repeat live runs before deciding that a skill improved.

*Acceptance:* `npm run test:eval` passes, `npm run eval -- --golden --no-run` accepts every golden, and `npm run eval -- --golden --no-run --judge` gives the goldens full advisory marks.

## What the test cases get wrong (on purpose)

`TOOL-1` was written before looking at the system. A good analysis finds all of these; a good spec follows the live behaviour:

| Test case says | System does | Finding |
|---|---|---|
| TC-1/TC-2: accepted message returns HTTP 201 | HTTP 200 with the record | `assert-observed` |
| TC-1: 49-character message rejected by the API | Accepted — the 50-character minimum exists only in the form | `move-to-ui` (covered by TC-4's UI rule) |
| TC-4: "`<Field>` is required" for the email field | Reads "Email is required" while the label is "Email address" | `assert-observed` |

## Working with a live public SUT

- It can be slow, rate-limited, or briefly down. CI retries twice; fixtures create data through the API; never depend on data you did not create.
- Base URLs come from `TOOLSHOP_UI_URL` / `TOOLSHOP_API_URL`. To run against your own copy, follow the upstream project <https://github.com/testsmith-io/practice-software-testing> and point the variables at it.
- Contact messages are written to a shared database. Use obviously synthetic data.

## Commands

| Command | Does |
|---|---|
| `npm run validate` | what a push and CI must pass: `schema:check` + typecheck + lint + ast-grep + `validate:pipeline` + `test:harness` |
| `npm run validate:pipeline [-- --progress] [TICKET]` | per ticket: inputs, exploration artifact, one traceable spec per test case; `--progress` only demands what the work so far implies |
| `npm run typecheck` / `lint` / `ast-grep` | the native tools, one each |
| `npm run schema:update` / `schema:check` | rewrite / verify the exported `*.schema.json` files |
| `npm run test` / `test:api` / `test:ui` | Playwright |
| `npm run test:harness` | core unit tests of gates, rules, and the validator |
| `npm run test:eval` | reusable eval-library tests plus concrete spec-eval calibration and runner tests |
| `npm run generate:types` | refresh OpenAPI types in `src/types/generated/` |
| `npm run eval [-- --golden TICKET --level=api --no-run --keep --judge --verbose]` | advanced: grade golden outputs, or run a live agent on each spec task and grade it (`--judge` adds the advisory LLM judge; `--verbose` prints every gate) |

## Layout

```
docs/adr/                              decisions (0001 = this pipeline)
wiki/TEST-STRATEGY.md                  what the agent must follow
.agents/
  harness-config.ts                    paths, timeouts, patterns
  lib/                                 shared gate/file helpers
    eval/                              reusable eval runner, judge, command and report modules
  skills/                              automate-test-case entry, three stage skills + 12 supporting skills
  manual-to-autotests-pipeline/        the concrete pipeline
    validate.ts                        the one custom check: inputs -> artifact -> specs
    input-validation/                  input schemas + gates (Phase 1)
    exploration-validation/            artifact schema + gates (Phase 2)
    specs-validation/                  spec gates + ast-grep rule tests (Phase 3-4)
    test-cases/  stories/  artifacts/  inputs and analyse-sut outputs
    eval/                              advanced: spec tasks, dataset, skeleton, graders (Phase 8)
scripts/run-eval.ts                    advanced eval CLI
.cursor/rules/                         file-scoped data, fixture, POM, API-client, and spec contracts
.cursor/hooks.json                     stop hook
.githooks/pre-push                     runs npm run validate
tools/ast-grep/                        rules
src/  tests/                           framework + specs (layers in AGENTS.md)
.github/workflows/                     CI
```
