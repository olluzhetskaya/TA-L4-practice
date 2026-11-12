# TA L4 Practice — Build an Agentic Test-Automation Pipeline

You build, from scratch, a pipeline that turns **manual test cases** into **green Playwright API + UI specs** — with an agent doing the typing and deterministic gates doing validation.

```
manual test cases (+ story) ─▶ input hook ─▶ read test strategy ─▶ analyse system under test ─▶ output hook
        ─▶ create-api-spec / create-ui-spec ─▶ lint + ast-grep hook ─▶ run tests ─▶ PR ─▶ CI keeps it green
```

System under test: **Toolshop** — UI <https://practicesoftwaretesting.com>, API <https://api.practicesoftwaretesting.com>, API docs <https://api.practicesoftwaretesting.com/api/documentation> (OpenAPI at `/docs`). Public demo customer: `customer@practicesoftwaretesting.com` / `welcome01`.

## Architecture design approach

The whole design is one bet: an agent is excellent at *producing* text and poor at *judging* its own output — so the agent writes, and deterministic code judges. Each idea below exists to keep that split honest.

- **Deterministic gates.** Every check is code that returns `pass` / `warn` / `fail` the same way every run — reproducible, reviewable, and identical whether you or the agent runs it. "Looks right" is never the bar; a named gate with a message is.
- **A defined output format between phases.** Analysis doesn't hand the spec phase prose — it writes a Zod-schema'd JSON artifact. A machine-checkable contract means the next phase can rely on it, and a mistake is caught at the boundary instead of surfacing three phases later as a mystery.
- **Fail loud and early.** Inputs, artifacts, and specs are each validated at their own boundary. A vague `expected`, an invented status, or a dangling AC reference is rejected where it's introduced, so bad data can't silently propagate.
- **Hooks close the loop automatically.** The stop hook feeds failures back to the agent as a to-do; the pre-push hook blocks a red push. The agent self-corrects without a human in the loop to remember to check — the guardrails run whether or not anyone is watching.
- **Grounded in the live system, traceable to a test case.** Assertions trace to behaviour actually observed on the SUT (not assumptions), and every spec maps back to a manual test case — nothing is tested that nobody asked for, and nothing asked for is left untested.

## Tools and instruments

Everything you need in this practicum. All of it is installed by `npm install` except the editor/CLI and `gh`.

| Tool | Role in the pipeline |
|---|---|
| **[Node.js](https://nodejs.org) ≥ 22** + **[npm](https://docs.npmjs.com)** | runtime and script runner (every `npm run …` below) |
| **[TypeScript](https://www.typescriptlang.org)** (`tsc`) + **[tsx](https://tsx.is)** | the whole pipeline is typed TS; `tsx` runs it directly, no build step |
| **[Zod](https://zod.dev)** ([repo](https://github.com/colinhacks/zod)) | schemas that validate inputs and artifacts (Phase 1 onward) |
| **[Playwright](https://playwright.dev)** (`@playwright/test`, [repo](https://github.com/microsoft/playwright)) | the API + UI specs and their fixtures; `playwright test` runs them |
| **[playwright-cli](https://github.com/microsoft/playwright-cli)** | drive a live browser session to explore the SUT in Phase 2 |
| **[ESLint](https://eslint.org)** (+ [`typescript-eslint`](https://typescript-eslint.io), [`eslint-plugin-playwright`](https://github.com/playwright-community/eslint-plugin-playwright), [`eslint-plugin-sonarjs`](https://github.com/SonarSource/SonarJS/blob/master/packages/analysis/src/jsts/rules/README.md)) | enforce the coding conventions; run as a gate |
| **[ast-grep](https://ast-grep.github.io)** (`@ast-grep/cli`, [repo](https://github.com/ast-grep/ast-grep)) | structural lint rules the agent must obey (Phase 4) |
| **[openapi-typescript](https://openapi-ts.dev)** ([repo](https://github.com/openapi-ts/openapi-typescript)) | generate typed API models from Toolshop's OpenAPI (`npm run generate:types`) |
| **[node:test](https://nodejs.org/api/test.html)** | unit tests for the harness — gates, rules, hooks, the eval framework (`npm run test:harness`) |
| **[`@cursor/sdk`](https://www.npmjs.com/package/@cursor/sdk)** | runs a real agent unattended for the evals (Phase 8); needs `CURSOR_API_KEY` |
| **[Agent Skills](https://agentskills.io/home)** (`.agents/skills/<name>/SKILL.md`) | the agent's recipes, in the open [Agent Skills](https://agentskills.io/home) format: a folder with a `SKILL.md` (name + description + instructions) that the agent loads only when a task matches. **Tool-agnostic**: any skills-compatible agent can use them; Cursor finds them through the `.cursor/skills` symlink to `.agents/skills`, another tool needs its own symlink or path |
| **[Cursor](https://cursor.com) agent and [hooks](https://cursor.com/docs/hooks)** | the agent writes the code; `.cursor/hooks.json` runs the gates automatically (Phase 5). This part is **Cursor-specific**; the gates it calls (`runGates`) are not |
| **[git hooks](https://git-scm.com/docs/githooks)** (`git config core.hooksPath`) | enforce pre-commit and pre-push checks for every contributor, not just the agent |
| **[git](https://git-scm.com)** + **[GitHub Actions](https://docs.github.com/actions)** + **[`gh` CLI](https://cli.github.com)** | version control, CI that keeps it green (Phase 7), and opening the PR (Phase 6) |

## How to use this repo

This repo is a complete, working example — the finished pipeline, all gates green, goldens verified against the live system. It is not a framework to extend or a starter to generate from; it's a worked reference. Read it to see how each phase is solved, then build the same pipeline in a project of your own by following the phases below.

Run `npm install && npx playwright install chromium`. Copy `.env.example` to `.env`.

Each phase below has the same shape: **Why** (what goes wrong without it), **Example** (a concrete before/after), **Build** (what to create), **Acceptance** (a command that must pass before you move on).

## What you are given

Think of the repo in two layers: the **starting point** you are handed, and the **finished pipeline** you build phase by phase. The second table is a map of every part of the finished one. Open it when you reach that phase, or later when you adopt a piece in your own project.

### The starting point

| Given | Where |
|---|---|
| Story + manual test cases for `TOOL-1` (contact form); the test cases are a Jira/Xray export | `.agents/manual-to-autotests-pipeline/stories/TOOL-1.md`, `.../test-cases/TOOL-1.json` |
| Test strategy the agent must follow. `wiki/` is the project's context folder: the agent reads it before it works, so put anything it should know there (domain glossary, environments, naming rules, known bugs, architecture notes) next to the strategy | `wiki/TEST-STRATEGY.md` |
| Framework core the specs sit on: env config and timeouts, typed API base client + `AuthApi`/`ContactApi`, `readJson` (Zod-parsed responses), `BasePage` + `ContactPage`, test data builders and enums, fixtures, tags, generated OpenAPI types | `src/`, `tests/fixtures/`, `playwright.config.ts` |
| Supporting [Agent Skills](https://agentskills.io/home) the spec skills delegate to: `playwright-cli`, `probe-sut`, `create-locators`, `pom-builder`, `data-layer`, `test-data-state-management`, `test-stability`, `playwright-annotations`, `typescript-types`, `architecture-best-practices`, `code-review`, `github-ci` | `.agents/skills/` |
| Coding conventions the agent reads (`AGENTS.md`) and the tools that enforce them: ESLint for types, imports and patterns, ast-grep for code shapes (Phase 4) | `AGENTS.md`, `eslint.config.mjs`, `tools/ast-grep/rules/` |

### The finished pipeline (what you build)

The harness is split in two on purpose. `.agents/lib/` is **generic**: it knows nothing about test cases or Playwright, so a different pipeline could reuse it unchanged. `.agents/manual-to-autotests-pipeline/` is the **concrete pipeline** built on it.

| Part | What it is | Where | Phase |
|---|---|---|---|
| Design record | the decision, the rejected options, the stage table | `docs/adr/` | 0 |
| Gate core | `pass` / `warn` / `fail` results and the `fix_required` / `continue` decision | `.agents/lib/gates/gateResults.ts` | 1 |
| Harness config | paths, timeouts, file patterns, eval protected files | `.agents/harness-config.ts` | 1 |
| Stage registry | the one list of stages: which files each owns, how to review them | `.agents/manual-to-autotests-pipeline/pipeline.config.ts` | 1 |
| Gate CLI | one entry for hook, CLI and CI (`npm run runGates`) | `.agents/scripts/runGates-cli.ts` | 1 |
| Input hook | test case and story schemas + gates | `.agents/manual-to-autotests-pipeline/input-validation/` | 1 |
| Analyse skill + gates | the skill, the artifact schema, five exploration gates | `.agents/skills/analyse-sut/` | 2 |
| Spec skills | `create-api-spec`, `create-ui-spec` | `.agents/skills/create-*-spec/` | 3 |
| Spec gates | traceability: title, annotation, level, step names, coverage | `.agents/manual-to-autotests-pipeline/specs-validation/` | 3 |
| Command gate | wraps any CLI (eslint, ast-grep, tsc, Playwright) as a gate | `.agents/lib/gates/commandGate.ts` | 3 |
| Lint rules | ESLint config + ast-grep rules with their tests | `eslint.config.mjs`, `tools/ast-grep/` | 4 |
| Hooks | Cursor `stop` hook, git pre-commit and pre-push, the pre-push runner | `.cursor/hooks.json`, `.githooks/`, `.agents/scripts/pre-push-hook.ts` | 5 |
| Specs | the generated API and UI specs for `TOOL-1` | `tests/api/`, `tests/ui/` | 6 |
| CI | validate, then the api/ui matrix, with reports | `.github/workflows/tests.yml` | 7 |
| Eval framework | generic runner, checks, scoring, judge, report | `.agents/lib/eval/` | 8 |
| Eval tasks and graders | dataset loader, workspace builder, spec checks, protected files, per-case run, judge rubric | `.agents/manual-to-autotests-pipeline/eval/` | 8 |
| Eval data | tickets `TOOL-1..3` with golden artifact and golden specs; the skeleton overlay | `.agents/manual-to-autotests-pipeline/eval/dataset/`, `.../eval/skeleton/` | 8 |
| Eval commands | live run and golden calibration | `scripts/run-eval.ts`, `scripts/verify-goldens.ts` | 8 |
| Harness tests | `node:test` for every gate, rule, hook and eval piece (`npm run test:harness`) | `*.test.ts` under `.agents/` | all |

The full folder map is under [Layout](#layout).

## Phase 0 — ADR

**Why.** An agent pipeline has many moving parts (stages, artifacts, gates, hooks). Without a written design, each part gets decided ad hoc while coding, and nobody can say later why a gate exists or what is deliberately left out. Writing the decision down first is also the cheapest place to discover a bad idea.

**Example.** The ADR in this repo weighs three options and rejects two, with a reason each:
- *One prompt, one pass* ("write a test for this case") — cheapest, but there are no contracts and no feedback loop, so failures only show up in review.
- *Record-and-replay / codegen only* — stable locators, but no assertions derived from intent, no API tests, no traceability.
- *Pipeline of skills with deterministic gates between stages* (chosen) — more to build, but every defect is caught at the stage that causes it.

**Build.** Copy `docs/adr/TEMPLATE.md` to `docs/adr/0001-agentic-test-automation-pipeline.md` and decide, before writing code: stages, artifacts and their formats, what each gate checks, who owns what, what is out of scope, how you will know it works. Name at least two rejected options.

> **Think first.** Before you open the template: which stages would you have, and what would you refuse to automate? What would make you trust the pipeline's output without reading it? An ADR that answers these in a page is better than a long one.

*Acceptance:* a reviewer can implement the pipeline from the ADR alone.

## Phase 1 — Input and input hook

**Why.** Everything downstream trusts the test cases. A vague expected result cannot become an assertion, and a dangling requirement link means a test nobody can trace. Catching this at the door costs one failing command; catching it after the spec is written costs a rewrite.

**Example.** The input is what Jira and [Xray](https://docs.getxray.app/space/XRAY/301474262/Tests+-+REST) give you: one Jira issue of type *Test* per manual test case, exported with a search (`GET /rest/api/2/search?jql=issue in linkedIssues(TOOL-1)`). This is one step of `TC-1`, trimmed to the fields we use:

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
      { "type": { "name": "Test" }, "outwardIssue": { "key": "TOOL-1", "fields": { "summary": "Contact customer service from the storefront" } } },
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

The test's own `summary` is its **objective** (`Verify that …`, `Confirm that …`), written as a SMART goal: one specific subject, a measurable outcome, small enough for one test. It is also the test's title, so it appears in every report. (The `summary` inside the story link is only the story's title.)

| | Summary | Why |
|---|---|---|
| ✗ | `Contact form` | a topic, not an objective: what is verified? |
| ✗ | `Verify that the contact form works` | not measurable: "works" can't be asserted |
| ✓ | `Verify that a visitor can send a message through the contact form` | one actor, one action, one observable outcome |
| ✓ | `Verify that the contact API rejects invalid messages and accepts a boundary-length message` | measurable (rejects / accepts), bounded by named cases |

Openers such as `Verify that` or `Confirm that` help, but no gate checks the wording: whether a goal is truly SMART is a review question.

Now compare two versions of one step's expected result:

```json
{ "action": "Send a message", "data": "valid message", "expected result": "works" }
```

```json
{
  "action": "Send a contact message of 251 characters",
  "data": "message: 251 x 'x'",
  "expected result": "HTTP 422; the validation error names the message field"
}
```

The first cannot be turned into an assertion: what does "works" check? The second names the status and the field, so the spec practically writes itself. A gate should tell the two apart.

Our file is an *export*, not something we upload, so it stays plain JSON you could produce from Jira with one request; it is not a creation request (`POST /rest/api/2/issue`) and carries no server-generated fields. The schema parses the export and hands every gate and skill one flat shape: `{ ticket, testCases: [{ id, title, level, priority, acRefs, preconditions, steps: [{ action, data, expected }], notes }] }`.

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

This is also where the harness is born. You can't check anything without a way to express a result and a way to run it, so build the minimal core here and immediately point it at `TOOL-1.json`. Later phases grow the harness next to the first thing that needs each piece, with no big framework up front.

**Build** the gate core, then the first gate on top of it:

- `.agents/lib/gates/gateResults.ts` — the shared result vocabulary: `pass` / `warn` / `fail` returning `{ gate, status, detail }`, and a `CheckResult` that aggregates gates into a `fix_required` / `continue` decision (any `fail` blocks). One vocabulary means the hook, the CLI, CI and the evals all read results the same way.
- `.agents/harness-config.ts` — paths, timeouts and file patterns in one place, so no gate hard-codes a directory.
- `.agents/manual-to-autotests-pipeline/pipeline.config.ts` — a stage registry (`STAGES`); start with a single `input` stage that owns `test-cases/*.json` and names its `review` function. The CLI, hooks, and CI all read it as you add stages.
- `.agents/scripts/runGates-cli.ts` — routes a file to its stage's `review` and exits non-zero on a failing gate. Start with `--all` / `--stage` / `--json`; the `--hook`, `--ci`, `--no-lint`, `--with-tests` flags come when later phases need them.
- `.agents/manual-to-autotests-pipeline/input-validation/` — `input-schemas.ts` and `review-input-files.ts`, the schema and the gates that run on it.

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

`npm run schema` exports the Zod schemas as JSON Schema (`*.schema.json`), so editors and the agent can read the contract without running code.

*Acceptance:* `npm run runGates -- .agents/manual-to-autotests-pipeline/test-cases/TOOL-1.json` passes. A copy with a vague `expected result` or an unknown `AC-9` fails with a message an agent can act on. Write a passing and a failing fixture per gate (`node:test`).

## Phase 2 — Analyse the SUT

**Why.** The test cases describe what someone *expects* the system to do. The agent that types the specs from them alone will assert the wrong status code and click a label that doesn't exist. A separate analysis step looks at the real system first and writes down what is true, so the spec phase builds on observations instead of assumptions — and when the two disagree, the disagreement is recorded as a finding instead of becoming a flaky test.

**Example.** The test case says "fill in *Email*" and "expect HTTP 201". The live page's field is labelled *Email address*, and the API answers `200` with the record. The artifact records the real label as the locator, the observed `200` as the response, and a finding `assert-observed` that explains the difference. The spec then asserts `200`.

**Build** `.agents/skills/analyse-sut/` — `SKILL.md`, `scripts/schema.ts`, `scripts/gates/`, `scripts/review-exploration-file.ts`.

The artifact `.agents/manual-to-autotests-pipeline/artifacts/explore-<TICKET>.json` is the contract between analysis and implementation. It must hold:

- **locators** — semantic (`getByRole`, `getByLabel`, …), probed on the live page, linked to a test case step; the rendered label differs from the test case wording
- **apiCalls** — method, path, auth, request/response fields, **live observations** (status + body for each case you fired), existing client or `needsClient`
- **scenarios** — per test case, at its level, steps referencing locators / calls
- **findings** — where the live system differs from the test case, each with one resolution: `assert-observed`, `move-to-ui`, `move-to-api`, `annotate-gap` (a product bug: the spec keeps the expected behaviour and is marked `test.fail`)
- **pomPlan** — pages and API clients to create or reuse

Skill steps: read strategy → resolve auth → walk the UI with `playwright-cli` in a named session → capture network → fire pre-flight API requests → write the artifact → run the hook until it passes.

> **Think first.** The artifact is written by an agent, and an agent can fill a JSON file with plausible nonsense. What would you check mechanically so that a made-up locator, an unobserved API call or a forgotten test case can't get through? Give each failure mode its own gate, so the message tells the agent exactly what to fix.

| What could be wrong | Gate catches it by | Mutation that must fail it |
|---|---|---|
| the file is not the contract | schema validation | delete `apiCalls` |
| the locator is a guess | semantic `getBy*` only; no CSS, XPath or `TODO` placeholders | `"locator": "div.form > input:nth-child(2)"` |
| a step points at something that does not exist | every reference (locator, call, finding) resolves | scenario step refers to locator `L9` |
| a test case was skipped | each test case has a scenario at its own level | remove the scenario for `TC-2` |
| the API call was never really made | at least one live observation per call | an `apiCall` with `observed: []` |

*Acceptance:* a hand-made reference for `TOOL-1` passes your gates; mutated copies (placeholder locator, dangling reference, missing scenario, API call without observations) each fail a *different* named gate. Then run the skill on `TOOL-1` and get an artifact that passes.

## Phase 3 — Spec skills and spec gates

**Why.** A skill is the recipe that makes the agent's output consistent from run to run; the gates are what makes it *checkable*. Without traceability gates, an agent can write plausible tests that map to no manual test case (scope creep) or skip one (silent gap).

**Example.** The agent writes `test('contact form works', …)` with no annotation. The `tc-trace` gate fails: `"contact form works" is not a test case title in TOOL-1`. After the fix the test is titled `Verify that a visitor can send a message through the contact form` (the manual title, verbatim) and carries `annotation: testCase('TC-3')`, which links it back to the manual test case.

**Build** `.agents/skills/create-api-spec/SKILL.md`, `.agents/skills/create-ui-spec/SKILL.md`, and the specs stage in `.agents/manual-to-autotests-pipeline/specs-validation/`.

This stage is the first that runs external tools as gates, so build the piece of harness that enables it:

- `.agents/lib/gates/commandGate.ts` — wraps any CLI as a gate: exit 0 = pass, otherwise fail with the tail of the output so the agent can act on it verbatim. The spec review (`review-spec-file.ts`) uses it to run eslint and ast-grep as gates; CI, the pre-push runner and the evals reuse it later.
- the traceability gates themselves (`spec-gates.ts`), registered as a `specs` stage in `STAGES`.

Skills are generic: no Toolshop endpoints inside. Keep them short by **delegating** to the supporting skills (each step names the skill to read) instead of repeating their rules. They must say how to map each finding to an assertion, reuse before creating, where data/POM/fixtures live, and how to verify (`runGates`, `playwright test`).

What a traceable test looks like (from `tests/ui/TOOL-1.contact.ui.spec.ts`):

```ts
test(
  'Verify that a visitor can send a message through the contact form',      // title = the manual title, verbatim
  { tag: [Tag.Ui, Tag.Smoke, Tag.Regression], annotation: testCase('TC-3') }, // link back to the manual test case
  async ({ contactPage }) => {
    await test.step('Confirm that sending the form shows the confirmation', async () => {  // step starts "Verify that" / "Confirm that"
      await contactPage.submit()
      await expect(contactPage.getAlert(ContactCopy.confirmation), 'Confirmation should replace the form').toBeVisible()
    })
  },
)
```

> **Think first.** If the agent writes the specs, how do you know it wrote *the* specs: all of them, and only them? List what you would verify about the file before running it. Ours: title = test case title · `testCase('TC-n')` annotation per test and it matches the title · test level matches the file name (`*.api.spec.ts` holds `api` cases) · step names start `Verify that` / `Confirm that` · every test case of that level is covered (a warning, so a split across files stays legal).

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
| `no-deep-relative-import` — aliases | `import { x } from '../../../src/data/x'` | `import { x } from '@data/x'` |
| `prefer-test-step` / `no-empty-test-step` — readable reports | a `test()` body with no `test.step` | `await test.step('Verify that …', …)` |

Fix lint errors, never suppress them (`eslint-disable` is itself an error).

*Acceptance:* `npm run ast-grep` and `npm run lint` pass on clean code and fail on each bad fixture (`specs-validation/ast-grep-rules.test.ts` runs them).

## Phase 5 — Wire the hooks

**Why.** Gates that only run when someone remembers to run them protect nothing. Hooks make the checks part of the workflow: the agent is corrected the moment it finishes a turn, and a red push can't leave the machine.

**Example.** The agent leaves a `page.waitForTimeout(2000)` in a spec and says "done". The stop hook runs, the `no-manual-sleep` rule fails, and the agent receives a follow-up message: *fix `tests/ui/TOOL-1.contact.ui.spec.ts`, use an auto-retrying assertion*. You did not type anything.

This phase needs one more harness piece before the hooks can call them:

- `.agents/scripts/pre-push-hook.ts` — runs `npm run validate:push` and returns a block/allow decision.

> **Think first.** Which check should run when? Slow checks on every keystroke get disabled; fast ones on every turn get ignored if they are noisy. Decide what runs after an agent turn, what on commit and what on push, and why. Our split: schema and semantic gates after a turn (seconds), static checks on commit, everything on push.

**Build** `.cursor/hooks.json` and activate the git hooks with `npm run hooks:install`. The whole agent hook is this:

```json
{
  "version": 1,
  "hooks": {
    "stop": [{ "command": "node --import tsx .agents/scripts/runGates-cli.ts --hook", "loop_limit": 3 }]
  }
}
```

`loop_limit` caps how many times the agent is sent back, so a gate it cannot satisfy ends the loop instead of running forever.

> **Note — agent hooks are tool-specific, not tool-agnostic.** The `stop` hook here uses Cursor's `.cursor/hooks.json`. If you build the same pipeline with a different agent, the wiring changes: Claude Code uses `.claude/settings.json`, other tools have their own conventions. The *concept* (run gates after every turn, bounce failures back) is portable; the config file and event names are not.

- **`.cursor/hooks.json` — Cursor agent hook:** `stop` → `node --import tsx .agents/scripts/runGates-cli.ts --hook` — reviews all stage files (schema + semantic gates only, no lint) after every agent turn; failures come back as a follow-up message (set a `loop_limit`).
- **`.githooks/pre-commit` — git hook:** typecheck + lint + ast-grep on every commit — fast static checks so bad code never enters the history.
- **`.githooks/pre-push` — git hook:** full `npm run validate:push` (typecheck + lint + ast-grep + all pipeline gates) on every push — the authoritative gate before anything leaves the machine.

*Acceptance:* introduce a bad locator and a stray `page.waitForTimeout` — the agent is sent back to fix both without you saying anything. Try `git push` with a failing gate — it is blocked with the reason.

## Phase 6 — Run, then open a PR

**Why.** Static gates prove the code is well-formed, not that it works. Specs have to run against the live system, and live systems are slow and sometimes briefly wrong — so flakiness is fixed with auto-retrying assertions, not sleeps, which only hide the race.

**Example.** A UI test clicks *Send* and immediately reads the confirmation: green on a fast run, red on a slow one. The fix is `await expect(contactPage.confirmation, 'Confirm that …').toBeVisible()`, which retries until the message appears, not `waitForTimeout(1000)`.

Run the generated specs (`npm run test:api`, `npm run test:ui`). Then:

```bash
npm run validate:push          # typecheck + lint + ast-grep + all gates
git checkout -b feature/TOOL-1-contact
git add -A && git commit -m "TOOL-1: contact form API and UI specs"
gh pr create --fill
```

*Acceptance:* the PR has green checks; every spec title maps to a test case.

## Phase 7 — CI that keeps it green

**Why.** A suite that was green on your machine on Tuesday says nothing about Friday. CI re-runs everything on every change, and a *scheduled* run catches the case that matters most for a suite on a live system: nobody touched the code, but the system changed. (An alert job that opens an issue on a red scheduled run is a natural next step; it is left out here to keep the workflow small.)

**Example.** The nightly run fails because the SUT changed a validation message. The run goes red in the Actions tab and its HTML report is attached, so you can see which assertion broke and open the trace.

**Build** `.github/workflows/tests.yml`: triggers on `pull_request`, `push` to `main`, a weekday `schedule`, and `workflow_dispatch`. Jobs: **validate** (`npm ci`, `validate:push`, `test:harness`) → **playwright** matrix `api`/`ui` (install browsers only for ui, `CI=true`, upload the HTML report always). Evals are not in CI: they call a paid agent and are slow, so they run on demand.

*Acceptance:* a PR with a deliberately broken assertion goes red and its report is downloadable; a manual `workflow_dispatch` run is green.

## Phase 8 (optional) — Evals

### Why

Gates tell you whether *one* output is acceptable. They don't tell you whether the **skill** is good: change a sentence in `create-api-spec/SKILL.md` and you can't know if the agent now writes better specs, worse ones, or the same. An eval is a repeatable experiment: the same input every time, an agent run unattended, and a score computed by code. It turns "I think the skill got better" into "11/12 checks passed before, 12/12 now".

### The shape of an eval

Three parts (this follows Anthropic's [develop tests](https://platform.claude.com/docs/en/test-and-evaluate/develop-tests) guidance):

| Part | What it is here | Where |
|---|---|---|
| **Dataset** | tickets with fixed inputs and a stored *golden* answer | `.agents/manual-to-autotests-pipeline/eval/dataset/` |
| **Runner** | stage a clean workspace → run the agent with a natural prompt → clean up | `lib/eval/run-task.ts`, `lib/eval/cursor-runner.ts` |
| **Scorer** | checks that return `pass` / `warn` / `fail`, aggregated into rates | `lib/eval/score.ts` + the grader in `eval/grade.ts` |

Design decisions worth copying, and why:

- **Evaluate the skills that write code, not the whole chain.** Only `create-api-spec` and `create-ui-spec` are evaluated. Their input (the analysis artifact) is the *golden* artifact, so a bad spec can't be blamed on a bad analysis, and the live SUT drifting between runs doesn't move the score.
- **Natural prompt, no skill named.** The task says *"Automate the api test cases for TOOL-2. Test cases: … Story: … SUT analysis: …"* — the way a person would. If the agent has to be told which skill to read, the skill description is broken, and the eval should show that.
- **Clean, disposable workspace.** A copy of the repo in a temp dir, without the dataset or eval scripts (so the agent can't read the answer). The `TOOL-1` item uses a *skeleton* (feature code removed) so the agent must build the page object and client; `TOOL-2` and `TOOL-3` use the *full* project so the agent must extend what exists.
- **Deterministic first, judge last.** See below.
- **The framework is generic.** `lib/eval/` has no idea what a spec is: `runTask` takes callbacks (`buildWorkspace`, `promptFor`, `gradeTask`, optional `judgeTask`). The pipeline supplies them in `manual-to-autotests-pipeline/eval/spec-task.ts`. Swap the callbacks and you can evaluate any other skill.

### What to check deterministically

Because the input is fixed, you know exactly what a correct output must contain, so almost everything can be a plain check.

> **Think first.** You know the ticket, its test cases and the golden answer. If you had to catch a lazy or sneaky agent, what would you check in the output? Think about shortcuts: what is the cheapest way for an agent to *look* done? Write your list, then compare.

Each check below is a small pure function over one shared context (`eval/spec-checks.ts`). A failing check names the thing to fix. This is the whole of the "no disabled tests" check, to show how small they can be:

```ts
export const noDisabledTestsCheck: SpecCheck = ({ source }) => [
  gateFromProblems(
    'no-disabled-tests',
    readDisabledTestMarkers(source).map(marker => `${marker} disables a test`),
  ),
]
```


| Check | Fails when | Why it is worth checking |
|---|---|---|
| lint + traceability (per spec file) | eslint / ast-grep error, title ≠ manual title, missing `testCase('TC-n')`, bad step names | reuses the Phase 3-4 gates, so the eval and the hook can never disagree |
| `tsc` | the workspace does not typecheck | catches an invented import or a wrong type |
| `coverage` | a test case has no test, or more than one | silent gaps and duplicate tests both inflate or hide coverage |
| `no-disabled-tests` | `test.skip` / `fixme` / `only` | a skipped test cannot fail, so it can fake a pass |
| `bug-marking` | `test.fail` is missing on a known bug case, or present on any other case | the agent must keep the expected behaviour and mark the bug — and must not hide a real failure behind `test.fail` |
| `protected-files` | config, tooling, other tickets' specs, or the task inputs changed | loosening `playwright.config.ts` or editing the test case would make every other check pass dishonestly |
| `parity:statuses` | for a test case, an `HttpStatus.*` the golden asserts is never asserted | the golden says `TC-1` expects `UNPROCESSABLE_ENTITY`; a spec that asserts `BAD_REQUEST` tests something else |
| `parity:assertions` *(warn)* | fewer `expect()` calls than the golden | a hint of a thin test; only a warning because two good tests can assert differently |
| `run:TC-n` | the test did not end as declared (a `test.fail` bug case that fails counts as pass) | the only proof the spec works; reported per test case, so you see *which* case broke |

Compare only **naming-independent facts** with the golden (status enums, assertion counts). Never compare helper names, constant names or file layout: the agent is free to choose them, and a check that penalises a different-but-valid choice measures nothing.

A check returns `warn` for a hint and `fail` for a rule. Only `fail` decides whether the task passed.

### What needs a judge

Some questions have no deterministic answer: *does this assertion really verify the expected result?* A test can have the right title, the right annotation, a `200` check and a green run — and still not look at the response body the test case cares about.

That is the one job of the **LLM judge** (`lib/eval/judge.ts`, `eval/judge-specs.ts`):

- **One criterion per test case**, built from the manual steps:

  ```
  judge:TC-2  The test annotated testCase('TC-2') verifies each expected result below with an
              assertion that would fail if that behaviour were wrong. Skipped results, loosened
              conditions and weak matchers fail this criterion.
              1. Send a message of 251 characters -> HTTP 422; the error names the message field
  ```

  A test that only checks `status === 422` and never looks at the field name should fail this criterion, and no gate would notice.
- The judge gets the written spec, the manual test cases, and the golden spec as a *reference answer* (one acceptable answer, not the only one).
- Its scope is stated in the prompt: ignore style, naming, annotations, compile or run status — gates already cover those.
- It returns JSON `[{ id, pass, reason }]`; anything unreadable or missing counts as a failed criterion. Results appear as `judge:TC-n`.
- It is **advisory**: it never changes pass/fail, because an LLM verdict is not reproducible enough to gate on. Use a different model than the one that wrote the specs (`CURSOR_JUDGE_MODEL`).
- **Calibrate it before trusting it:** `npm run eval:goldens -- --judge` must give the golden specs full marks. A judge that fails the answer key is noise.

Rule of thumb: if you can write the check as code, do; the judge covers only what remains.

### Setting it up

What you need:

1. `CURSOR_API_KEY` in `.env` (and optionally `CURSOR_JUDGE_MODEL`).
2. A dataset item per ticket in `eval/dataset/<TICKET>/`: `test-cases.json`, `story.md`, `explore.json` (golden artifact, the input) and `golden/` (golden spec plus the support code it needs, at repo-relative paths).
3. For a skeleton item, `eval/skeleton/` (neutral replacements for the shared files that mention the reference feature).

Pieces to build, in this order (each is small and unit-tested with `node:test`, no live agent):

1. `lib/eval/check.ts` — the `Check` type (`name`, `status`, `detail`).
2. `lib/eval/cursor-runner.ts` — `AgentRunner`, a function `(prompt, { workspace, timeoutMs }) => text`. It is a seam: tests pass a fake runner.
3. `lib/eval/run-task.ts` — `runTask` (workspace → agent → grade → optional judge → clean up).
4. `lib/eval/score.ts` — per-task and suite scores: all-pass rate, check pass rate, per-check stats, judge pass rate.
5. `lib/eval/judge.ts`, `lib/eval/report.ts` — judge prompt + verdict parsing; readable output.
6. In the pipeline: `dataset.ts`, `workspace.ts`, `spec-context.ts`, `spec-checks.ts`, `protected-files.ts`, `run-specs.ts`, `grade.ts`, `spec-task.ts`.

Commands:

| Command | Does |
|---|---|
| `npm run eval:goldens` | grade the **golden** outputs with the same checks: all must pass. This is the calibration of the graders themselves (`-- --no-run` skips Playwright, `-- --judge` also calibrates the judge) |
| `npm run eval` | run a live agent on every spec task and grade what it wrote. Options: ticket argument, `--level=api\|ui`, `--no-run`, `--keep` (keep the workspace to inspect), `--judge`, `--threshold=0.8` (share of tasks that must pass; default 1) |

Always run `eval:goldens` first. If a golden fails, the grader is wrong, not the agent. Then check the graders can *fail*: the unit tests (`spec-task.test.ts`, `spec-checks.test.ts`) include an agent that writes nothing, a spec that loosens the bug assertion, a changed config file, and so on, each of which must be caught.

### Reading the result

```
ok   TOOL-1 api
FAIL TOOL-2 api
       protected-files: playwright.config.ts was modified
       run:TC-2: Expected 422 …
tasks passed: 5/6 (83.3%); checks passed: 97.1%
```

- **Tasks passed** is the headline: a task passes only if every check passed (warnings allowed).
- **Checks passed** is the sensitive number: it moves when one rule starts failing even if the whole task already failed.
- **Per-check stats** show *which* rule your last skill edit broke.

An agent is not deterministic: run the same eval a few times before reading a single difference as signal.

Reference items: `TOOL-1` (build everything from a skeleton), `TOOL-2` (API field limits; contains a product bug the spec must mark with `test.fail`), `TOOL-3` (UI product search; needs a new page object and API client).

*Acceptance:* `npm run eval:goldens` passes 100%; the tests in `test:harness` show that an empty output, a missing `test.fail`, a skipped test and an edited config each fail a *different* named check; a live `npm run eval` produces a score table you can compare before and after a skill edit.

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
| `npm run validate:push` | schema regen + typecheck + lint + ast-grep + all pipeline gates (what a push must pass) |
| `npm run runGates -- <file…>` | review specific files; flags: `--all`, `--stage input\|analyse-sut\|specs`, `--ci`, `--json`, `--no-lint`, `--with-tests` |
| `npm run test` / `test:api` / `test:ui` | Playwright |
| `npm run test:harness` | unit tests of gates, rules, hooks, eval framework |
| `npm run generate:types` | refresh OpenAPI types in `src/types/generated/` |
| `npm run eval:goldens [-- TICKET --no-run --judge]` | grade the golden outputs: gates + typecheck + live run |
| `npm run eval [-- TICKET --level=api --no-run --keep --judge --threshold=0.8]` | run a live agent on each spec task and grade it (needs `CURSOR_API_KEY`) |

## Layout

```
docs/adr/                              decisions (0001 = this pipeline)
wiki/TEST-STRATEGY.md                  what the agent must follow
.agents/
  harness-config.ts                    paths, timeouts, patterns
  lib/                                 generic harness — no pipeline knowledge
    gates/                             pass/warn/fail gates, commandGate
    eval/                              eval framework: runner, checks, scoring, judge, report
  scripts/                             runGates CLI, pre-push hook
  skills/                              analyse-sut, create-api-spec, create-ui-spec + 12 supporting skills
  manual-to-autotests-pipeline/        the concrete pipeline
    pipeline.config.ts                 stage registry — single source of truth
    input-validation/                  input hook (Phase 1)
    specs-validation/                  spec gates + ast-grep rule tests (Phase 3-4)
    test-cases/  stories/  artifacts/  inputs and analyse-sut outputs
    eval/                              spec tasks, dataset, skeleton, graders (Phase 8)
scripts/                               run-eval.ts, verify-goldens.ts
.cursor/hooks.json                     stop hook
.githooks/                             pre-commit, pre-push
tools/ast-grep/                        rules + scan script
src/  tests/                           framework + specs (layers in AGENTS.md)
.github/workflows/                     CI
```
