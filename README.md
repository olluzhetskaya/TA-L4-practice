# TA L4 Practice — Build an Agentic Test-Automation Pipeline

You build, from scratch, an agentic pipeline that turns **manual test cases** into **automated API and UI tests** — from requirements to green, traceable specs. The example uses a TypeScript + Playwright framework, but the approach applies to any language and test tool: the agent contract, JSON boundaries, deterministic gates, and hook mechanics are framework-agnostic.

```
manual test cases (+ story)
  ─▶ [input validation]  schema + domain checks on requirements
  ─▶ [SUT exploration]   live browser/API session → structured JSON artifact
  ─▶ [evidence gates]    schema + coverage checks on the artifact
  ─▶ [spec generation]   agent writes API + UI tests
  ─▶ [static analysis]   types + lint + code-shape + convention gates
  ─▶ [test execution]    run the generated specs against the SUT
  ─▶ PR / CI
```

System under test: **Toolshop** — UI <https://practicesoftwaretesting.com>, API <https://api.practicesoftwaretesting.com>, API docs <https://api.practicesoftwaretesting.com/api/documentation> (OpenAPI at `/docs`). Public demo customer: `customer@practicesoftwaretesting.com` / `welcome01`.

## The core pattern

An agent produces two kinds of output: **structured data** (JSON artifacts) and **source code** (specs, page objects, helpers). The validation approach follows the output type.

### Why JSON between phases

An agent asked to "explore the login page" will write prose or can skip an action entirely, hallucinating locators it never observed. That is unverifiable: the next phase can't assert it covers every acceptance criterion, can't check that every locator was actually observed, and can't tell whether a field was omitted or just not mentioned. When the output is a JSON object with a schema, the boundary becomes a contract: required fields are present or the gate fails; extra prose lives in a typed string field, not scattered through free text. Downstream phases receive data they can rely on, and mistakes surface at the phase boundary instead of as a mystery three phases later.

### Why hooks

A hook is a callback registered for a lifecycle event — the tool (agent runtime, git, CI) calls it automatically at a fixed point in the workflow, with no action required from the person or agent running the task. The key property is *unconditional execution*: neither the agent nor the developer has to remember to run a check — the hook fires regardless.

Two hook types are used here:

- **Agent stop hook** (`.cursor/hooks.json`, `stop` event): fires after every agent turn, before the next message is read. The hook receives the agent's output and its return value is injected as a follow-up message the agent sees immediately.
- **Git pre-push hook** (`.githooks/pre-push`): fires before `git push` transfers anything. A non-zero exit blocks the push.

An agent can produce valid TypeScript that breaks a convention. The agent won't notice unless it's told. A stop hook runs the domain validator after every turn and injects any failures as a follow-up message; the agent sees its own mistakes immediately and corrects them before moving on. Without the hook, every violation is a manual review item.

Hooks are also how the guardrails apply to the agent's natural workflow rather than requiring a separate check the agent might skip: the same validator runs whether the agent calls it explicitly or not.

**Structured data** is validated with a schema and optional domain checks:

| Layer | What it checks | TypeScript stack | Python stack | Java stack |
|---|---|---|---|---|
| Schema | shape, types, required fields | Zod `safeParse` | Pydantic `model_validate` | Jackson + Bean Validation (`@NotNull`, `@Pattern`) |
| Domain checks | business rules the schema cannot express | custom gate functions | custom validator functions | custom rule functions |

**Source code** is validated with static analysis and convention checks:

| Layer | What it checks | TypeScript stack | Python stack | Java stack |
|---|---|---|---|---|
| Types | correct types, no unsafe casts | `tsc --noEmit` | `mypy` | `javac` + `maven-compiler-plugin` |
| Style/imports | conventions, unused code, banned patterns | ESLint + plugins | Ruff / Flake8 | Checkstyle + PMD |
| Code shapes | structural patterns a linter can't match | ast-grep | ast-grep or Semgrep | Semgrep or PMD XPath rules |
| Domain checks | traceability, naming, fixture wiring | custom gate functions | custom gate functions | custom gate functions |

The custom domain gates are the small, project-specific layer. Everything else uses existing tools.

**Adopting this pattern** means: pick a schema library for your language, wire the standard static-analysis tools already used by your stack, and write only the checks that know your domain. The pipeline structure — inputs → structured artifact → generated code → validation at each boundary — works in any language.

## Agentic tool concepts

An agent-driven pipeline uses three kinds of guidance. They differ in scope and portability:

| Guidance type | Scope | Portable? | Cursor | Claude Code | GitHub Copilot |
|---|---|---|---|---|---|
| **Always-on conventions** | whole repository | ✅ tool-agnostic | `AGENTS.md` | `CLAUDE.md` | `.github/copilot-instructions.md` |
| **File-scoped rules** | activates for matching files | ❌ tool-specific wiring | `.cursor/rules/*.mdc` | `.claude/rules/` | `.github/instructions/*.instructions.md` |
| **On-demand skills** | loaded only for a named task | ✅ tool-agnostic ([Agent Skills](https://agentskills.io/home) format) | `.cursor/skills` → `.agents/skills` | `.claude/commands/` | Copilot Extensions |

Skills are the most portable layer: written once in the [Agent Skills](https://agentskills.io/home) format, they can be reused across any compatible agent. Rules and hooks are tool-specific wiring around the same contracts — the concept (activate on file match; run gates after every turn; bounce failures back) is portable, but the config file and event names are not. `AGENTS.md`-style always-on conventions are readable by any agent that follows the [AGENTS.md](https://agentprotocol.ai) convention.

The automation engineer defines these layers for the real project before asking the agent to generate code. Adapt the supplied examples to the project's architecture, naming, data ownership, and quality bar; do not copy rules or skills that describe a different framework. Keep them current when the framework changes.

## Tools and instruments

Tools are grouped by what they do in the pipeline, not by what they are. `npm install` installs the project dependencies; Cursor, `playwright-cli`, and `gh` are installed separately.

**JSON validation** — schema and domain checks on structured pipeline data

| Tool | This example | Alternative |
|---|---|---|
| Schema validation | [Zod](https://zod.dev) `safeParse` | Pydantic, Jackson + Bean Validation |
| API type generation | [openapi-typescript](https://openapi-ts.dev) (`npm run generate:types`) | openapi-generator, datamodel-code-generator |
| Custom domain gates | TypeScript gate functions in `.agents/` | any language |

**Static code analysis** — checks on generated test code

| Tool | This example | Alternative |
|---|---|---|
| Type checker | [TypeScript](https://www.typescriptlang.org) `tsc --noEmit` | mypy, javac |
| Style / import rules | [ESLint](https://eslint.org) + [`typescript-eslint`](https://typescript-eslint.io) + [`eslint-plugin-playwright`](https://github.com/playwright-community/eslint-plugin-playwright) + [`eslint-plugin-sonarjs`](https://github.com/SonarSource/SonarJS/blob/master/packages/analysis/src/jsts/rules/README.md) | Ruff, Checkstyle + PMD |
| Code-shape rules | [ast-grep](https://ast-grep.github.io) | Semgrep, PMD XPath |
| Convention gates | TypeScript gate functions in `.agents/` | any language |

**Test automation framework (TAF)** — the layer the agent generates tests for

| Tool | This example | Alternative |
|---|---|---|
| Test runner + assertions | [Playwright](https://playwright.dev) `@playwright/test` | pytest, JUnit, Vitest |
| Live SUT exploration | [playwright-cli](https://github.com/microsoft/playwright-cli) | manual, Selenium IDE |
| Harness unit tests | [node:test](https://nodejs.org/api/test.html) | pytest, JUnit |

**Agent tooling** — guidance, automation, and feedback loop

| Tool | This example | Alternative |
|---|---|---|
| Agent + hooks | [Cursor](https://cursor.com) + [hooks](https://cursor.com/docs/hooks) (`stop` event, `.cursor/hooks.json`) | Claude Code (`.claude/settings.json`), custom agent loop |
| Always-on conventions | `AGENTS.md` | `CLAUDE.md`, `.github/copilot-instructions.md` |
| File-scoped rules | `.cursor/rules/*.mdc` | `.claude/rules/`, `.github/instructions/` |
| On-demand skills | [Agent Skills](https://agentskills.io/home) (`.agents/skills/`) | Claude commands, Copilot Extensions |
| Unattended evals | [`@cursor/sdk`](https://www.npmjs.com/package/@cursor/sdk) (`CURSOR_API_KEY`) | Cursor SDK, custom runner |

**Version control and CI**

| Tool | Role |
|---|---|
| [git](https://git-scm.com) + pre-push hook | blocks a red push for every contributor, not just the agent (`git config core.hooksPath`, set by `npm install`) |
| [GitHub Actions](https://docs.github.com/actions) + [`gh` CLI](https://cli.github.com) | CI that runs the same `npm run validate` as pre-push; `gh` opens the PR |

**Runtime**

| Tool | Role |
|---|---|
| [Node.js](https://nodejs.org) ≥ 22 + [npm](https://docs.npmjs.com) | script runner for every `npm run …` command |
| [tsx](https://tsx.is) | runs harness TypeScript directly, no build step |

## Setup

```
npm install && npx playwright install chromium
cp .env.example .env
```

Each phase below has the same shape: **Why** (what goes wrong without it), **Example** (a concrete before/after), **Build** (what to create), **Acceptance** (a command that must pass before you move on).

## What is in this repo

**Inputs** — what the pipeline is built around

| What | Where |
|---|---|
| System under test: Toolshop contact form (`TOOL-1`) | UI: practicesoftwaretesting.com, API: api.practicesoftwaretesting.com |
| Requirements: story + manual test cases (Jira/Xray export) | `stories/TOOL-1.md`, `test-cases/TOOL-1.json` |
| Project context: domain glossary, environments, naming rules, known bugs | `wiki/` |
| TAF: Playwright typed clients, page objects, data builders, fixture injection | `src/`, `tests/fixtures/` |
| Agent contract: always-on conventions, file-scoped layer rules | `AGENTS.md`, `.cursor/rules/` |

**Agent concerns** — skills and rules

| What | Where |
|---|---|
| Design record: stages, artifacts, gate scope, rejected options | `docs/adr/` |
| Entry skill: one prompt → input check → SUT exploration → spec generation → verification | `.agents/skills/automate-test-case/` |
| Analyse-SUT skill: live session recipe that produces the JSON artifact | `.agents/skills/analyse-sut/` |
| API and UI spec skills | `.agents/skills/create-api-spec/`, `.agents/skills/create-ui-spec/` |
| Supporting skills: `probe-sut`, `create-locators`, `pom-builder`, `data-layer`, `test-stability`, `code-review`, … | `.agents/skills/` |
| File-scoped rules: data, fixtures, POM, API client, spec layer contracts | `.cursor/rules/` |

**Validation scripts** — JSON validation, static analysis, and hooks

| What | Where |
|---|---|
| Input schemas + domain gates (title, AC links, priority, story reference) | `.agents/manual-to-autotests-pipeline/input-validation/` |
| Exploration artifact schema + five evidence gates (locators, network calls, findings, coverage) | `.agents/manual-to-autotests-pipeline/exploration-validation/` |
| Spec convention gates: traceability, step names, fixture injection, hardcoded data, one test per case | `.agents/manual-to-autotests-pipeline/specs-validation/` |
| `tsc`, ESLint (playwright + sonarjs), ast-grep rules, spec import boundary | `tsconfig.json`, `eslint.config.mjs`, `tools/ast-grep/` |
| Single validation entry point for stop hook, CLI, and CI | `.agents/manual-to-autotests-pipeline/validate.ts`, `.agents/lib/` |
| Cursor stop hook: validator fires after every turn, failures injected as follow-up | `.cursor/hooks.json` |
| Git pre-push hook: `npm run validate` blocks a bad push | `.githooks/` |
| Evals (optional): agent runner, deterministic graders, optional LLM judge, CLI | `.agents/lib/eval/`, `.agents/manual-to-autotests-pipeline/eval/` |

**TAF + CI** — generated tests and CI

| What | Where |
|---|---|
| Generated API + UI specs for `TOOL-1` | `tests/api/`, `tests/ui/` |
| CI workflow: validate → api/ui matrix → reports | `.github/workflows/tests.yml` |

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

A person or the agent may validate or refine the test case (sharpen a vague `expected result`, add a missing precondition, split a case). The input schema and gates run on every change through the stop hook, so whatever edits the file, the Jira/Xray shape and the rules above stay enforced.

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

> **Think first.** You are handed a manual test case file. Before you read our list: what would you check, so that nothing downstream has to guess? Write down your own list, then compare it with the one below. What would you add?

| What to check | Our gate | A failure looks like |
|---|---|---|
| Required fields present and correctly typed: `key`, `summary`, `components`, `priority`, `steps`, `expectedResult` | `schema` | `issues.0.fields.components: Invalid input: expected array` |
| `steps` is a non-empty array; each step has a non-null, non-empty action | `schema` | `steps.0.action: Required` |
| `expectedResult` is non-null and non-empty on every step | `schema` | `steps.2.expectedResult: too short to assert on` |
| `priority` is one of the allowed values (`Critical`, `High`, `Medium`, `Low`) | `schema` | `priority: invalid enum value — got "Blocker"` |
| Test case links to a story, and all tests in the file link to the same story | `ticket-match` | `file name says TOOL-2 but "ticket" is TOOL-1` |
| Every requirement reference (`acRefs`) exists in the linked story | `ac-refs` | `acRefs not found in the story: TC-1 → AC-9` |
| Each expected result is concrete enough to become an assertion (no "should work", "not error") | `concrete-expected` | `expected result is too vague to assert on: TC-2 step 3` |
| IDs and titles are unique across the file | `schema` refinement | `duplicate id TC-1` |
| Story file is present to trace against (optional) | `story` | warn: `no story found` |
| Test-strategy wiki is present for the agent to read | `strategy` | `wiki/TEST-STRATEGY.md is missing` |


**Build**

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

 **Concrete input validation checks.** The schema for the test case file and the gates from the table above, as a function that takes a ticket and returns its results. (`.agents/manual-to-autotests-pipeline/input-validation/`)


Run the validator by hand and by npm script (`npm run validate:pipeline`); you wire it to the agent's `stop` event and to git in Phase 5.

*Acceptance:* `npm run validate:pipeline -- --progress TOOL-1` passes. A copy with a vague `expected result` or an unknown `AC-9` fails with a message an agent can act on.

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

The goal is correct code on the first run, not code that becomes correct only after lint repeatedly rejects it. Use the three layers from the [Agentic tool concepts](#agentic-tool-concepts) section:

- **`AGENTS.md`:** always-on repository-wide conventions.
- **`.cursor/rules/*.mdc`:** file-scoped layer contracts. Rules deliberately overlap: while editing a spec, the data and fixture rules also load; UI specs additionally load the POM rule, and API specs load the API-client rule.
- **`.agents/skills/*/SKILL.md`:** on-demand procedural workflows such as analysing the SUT, creating an API/UI spec, choosing locators, building a page object, or managing test state.

Keep each fact at the narrowest useful level: universal policy in `AGENTS.md`, layer contracts in project rules, and multi-step instructions in skills. ESLint, ast-grep, TypeScript, pipeline gates, and Playwright are the second phase — a deterministic safety net and feedback loop, not the primary source of coding instructions.

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

Skip this on a first pass: the core pipeline is complete after Phase 7. Evals are a separate, advanced exercise, and they only grade the spec-writing skills. They teach both kinds of grader: deterministic checks first, then an LLM judge for what is left. The judge is built and unit-tested but costs tokens, so it only runs when you pass `--judge`.

### Why

Gates tell you whether *one* output is acceptable. They don't tell you whether the **skill** is good: change a sentence in `create-api-spec/SKILL.md` and you can't know if the agent now writes better specs, worse ones, or the same. An eval is a repeatable experiment: the same input every time, an agent run unattended, and a result computed by code. It turns "I think the skill got better" into "4/4 tasks passed before, 3/4 now".

### Vocabulary

| Term | Meaning |
|---|---|
| **Dataset item** | One ticket with fixed inputs (test cases, story, exploration artifact) and a *golden* output — one acceptable answer, not the only one. |
| **Task** | A `(dataset item × test level)` pair — one unit the agent is asked to deliver in one run. |
| **Workspace** | Disposable copy of the repo where the agent writes; deleted after grading unless `--keep`. |
| **Gate** | Deterministic check with `pass` / `warn` / `fail`. Any `fail` fails the task. |
| **Judge** | Optional LLM check reported as `judge:TC-n`. Advisory — never decides task pass/fail. |

### Where it lives

| Part | What it is here | Where |
|---|---|---|
| **Runner library** | run an agent task, execute command gates, build/parse judge verdicts, parse annotated Playwright reports | `.agents/lib/eval/` |
| **Dataset** | this pipeline's tickets with fixed inputs and a stored *golden* answer | `.agents/manual-to-autotests-pipeline/eval/dataset/` |
| **Spec task** | stage this pipeline's workspace, build its prompt, grade it, clean up | `.agents/manual-to-autotests-pipeline/eval/spec-task.ts`, `workspace.ts` |
| **Grader** | apply shared spec gates and this pipeline's golden/protected-file checks | `.agents/manual-to-autotests-pipeline/eval/grade.ts`, `spec-checks.ts` |
| **Judge** (opt-in) | reusable prompt/parsing plus this pipeline's test-case rubric; advisory | `.agents/lib/eval/judge.ts`, `.agents/manual-to-autotests-pipeline/eval/judge.ts` |

Reusable mechanics under `.agents/lib/eval/` know nothing about tickets, manual-test schemas, or this pipeline's annotation name. Everything concrete (dataset, workspace, graders, rubric, `'test-case'` annotation) lives under `.agents/manual-to-autotests-pipeline/eval/`. The example deliberately evaluates only spec creation: each task receives fixed inputs and asks the agent naturally to write the spec in a disposable workspace. This isolates the skill being measured and prevents live-system drift from changing the input.

Principle: run cheap, reproducible checks first and let them decide pass/fail. Ask an LLM judge only the quality question code cannot answer reliably, and keep it advisory because its answer is not deterministic.

### Create a dataset item

A dataset item is a directory under `.agents/manual-to-autotests-pipeline/eval/dataset/<TICKET>/`:

```
TOOL-2/
  test-cases.json                              # Xray export (Phase 1 shape)
  story.md                                     # # <title> + ## Acceptance Criteria with **AC-n** bullets
  explore.json                                 # golden analyse-sut artifact (Phase 2 shape)
  golden/                                      # one acceptable output the agent should match
    tests/api/TOOL-2.contact-limits.api.spec.ts
    src/data/contact.ts                        # any support code the spec needs
```

Checklist to add `TOOL-N`:

1. **Mirror the layout** of an existing ticket — `TOOL-2` for API, `TOOL-3` for UI. Keep the ticket id consistent in every file and in every spec file name (`TOOL-N.<slug>.<level>.spec.ts`).
2. **`test-cases.json`** — reuse the Xray schema. Every case links back to `TOOL-N`, each `AC-n` label must exist in `story.md`, every step needs a concrete `expected result`. The Phase 1 gates run on this file too.
3. **`story.md`** — `# TOOL-N: <title>` followed by `## Acceptance Criteria` and one `**AC-n**` bullet per criterion.
4. **`explore.json`** — observe the live SUT first. Each API call needs at least one `observed { case, status, body }`. Any product bug goes in `findings` with `resolution: "annotate-gap"`; the eval expects `test.fail` on those cases.
5. **`golden/`** — hand-write the output the agent should produce. Specs under `tests/<level>/TOOL-N.*.<level>.spec.ts`; any helpers, data builders, or fixtures the spec imports sit beside them under `src/` or `tests/fixtures/`.
6. **Calibrate** — `npm run eval -- --golden TOOL-N --no-run --verbose`. Every deterministic gate must pass. If a gate fails, fix the golden, not the gate.

The reference ticket `TOOL-1` lives in the main repo (see `skeleton.ts`): its feature code is removed before the agent runs so it writes the framework *and* the spec from scratch (`base: 'skeleton'`). Dataset items under `eval/dataset/` are `base: 'full'` — the agent extends the finished framework and only writes the spec.

### What a task is

`tasksFor(items)` produces one task per `(ticket × level)`:

```
TOOL-1 × api     # skeleton base — agent writes framework + spec
TOOL-1 × ui
TOOL-2 × api     # full base — agent writes spec only
TOOL-3 × ui
```

Each task runs through `runSpecTask`:

1. **Stage** — copy the repo to a temp workspace; symlink `node_modules`; exclude eval data, `.env`, auth. Skeleton tasks also drop the reference feature code.
2. **Prompt** — the agent receives a plain, no-skill-named request with the three input paths so it has to pick the right skill itself:
   > Automate the api test cases for TOOL-2. Test cases: … Story: … SUT analysis: … Do not ask questions; finish autonomously.
3. **Grade** — run every gate against the workspace; collect the results.
4. **Judge (opt-in)** — ask a different LLM only the "do the assertions verify the expected results?" question.
5. **Clean** — delete the workspace unless `--keep`.

Two task flavours are useful:

- **Skeleton task** (`TOOL-1`) measures *end-to-end* skill: can the agent infer page objects, API clients, fixtures, and specs from the inputs alone?
- **Full task** (`TOOL-2`, `TOOL-3`, …) isolates the *spec skill*: can it extend an already-correct framework without touching anything else?

### Scoring by example

One task, `TOOL-2 × api`. The agent writes `tests/api/TOOL-2.limits.api.spec.ts`. Each row is one gate produced by `gradeSpecs`:

| Gate | Answers | Fail message |
|---|---|---|
| `TOOL-2.spec.ts: trace` | every `test(…)` has a `testCase('TC-n')` matching its title | `"Sends over-limit" is not a TC title in TOOL-2` |
| `TOOL-2.spec.ts: step-names` | step names start `Verify that` / `Confirm that` | `step 1: missing manual-action prefix` |
| `TOOL-2.spec.ts: manual-step-names` | step names echo the manual action wording | `step 2 does not match any TC-1 action` |
| `TOOL-2.spec.ts: raw-fixture` | no `async ({ page, request })` in spec args | `TC-1 injects page directly` |
| `coverage` | every manual case covered **exactly once** | `TC-3 is not covered` / `TC-1 has 2 tests` |
| `no-hardcoded-data` | payload literals come from fixtures/responses | `TC-1 inlines "jane@example.com"` |
| `eslint` | project ESLint passes with `--max-warnings=0` | `no-unused-vars at line 12` |
| `ast-grep` | no `page.goto`, no status literal, no manual sleep … | `no-status-literal-in-assert at line 42` |
| `tsc` | the workspace still typechecks | `TS2322: … not assignable to …` |
| `no-disabled-tests` | no `skip` / `fixme` / `only` | `TC-2 is .skip` |
| `bug-marking` | `test.fail` set iff the case has an `annotate-gap` finding | `TC-2 hits a product bug — must call test.fail('BUG: …')` |
| `parity:statuses` | asserts every HTTP status the golden asserts | `TC-1 never asserts HttpStatus.UNPROCESSABLE_ENTITY` |
| `parity:assertions` | asserts at least as strongly as the golden | `TC-3 lacks matcher: toMatchObject` |
| `protected-files` | configs, tools, harness, other tickets' specs, task inputs unchanged | `playwright.config.ts was modified` |
| `run:TC-n` (unless `--no-run`) | Playwright executes that test case green | `TC-1: expected 422, got 200` |
| `judge:TC-n` (with `--judge`) | *advisory* — assertions actually verify each expected result | `TC-2 verifies status but not the field-level error` |

A task passes iff every non-advisory gate passes. Judge results are listed next to the others but never flip `passed`. Golden comparisons look at asserted statuses and matcher strength, not helper names or file layout, so a different valid implementation can pass.

### More task examples

The gate-by-gate walkthrough above is `TOOL-2 × api`. Two more task shapes exercise different parts of the skill — same gates, different criteria that matter.

**`TOOL-3 × ui`** (full base, UI spec with POM)

Inputs: a story for "search the product listing", three test cases (TC-1 search for an existing product, TC-2 search with no matches shows empty-state, TC-3 clear search restores full listing), and an exploration artifact that records `getByRole('searchbox')` as the input and `getByText('No products found')` as the empty state. No product bugs.

| Criterion | Pass example | Fail example |
|---|---|---|
| **Coverage + traceability** | one `test` per TC with manual title + `testCase('TC-n')` + tag `Ui` | `"search works" is not a TC title in TOOL-3` |
| **POM discipline** | spec calls `productsPage.search(…)` / `.getResults()`; no `page.getByRole` in the spec | `no-page-locator-in-spec at line 14` |
| **Navigation in the POM** | `await productsPage.open()` — no `page.goto('/')` in the spec | `no-goto-in-spec at line 10` |
| **Stability** | `await expect(...).toBeVisible()`; no `waitForTimeout`, no `.nth(0)` | `no-manual-sleep at line 22` |
| **Assertion parity** | TC-1 asserts product visible by name, TC-2 asserts the empty-state message, TC-3 asserts baseline restored | `TC-2 lacks matcher: toBeVisible` |
| **Isolation** | may add `src/pages/ProductsPage.ts`; must not rewrite the shared fixture | `tests/fixtures/toolshop.fixture.ts was modified` |
| **Green execution** | `run:TC-1..3` all green against the live SUT | `run:TC-2: expected locator visible, got 0 matches` |
| **Assertion intent** (advisory) | TC-2 asserts the empty state is *shown*, not merely that no product row exists | `judge:TC-2 does not verify the "No products found" message` |

**`TOOL-1 × api`** (skeleton base, agent writes framework + spec)

Inputs: the full `TOOL-1` test cases, story, and exploration artifact. The workspace has the reference feature stripped — `src/data/contact.ts`, `src/helpers/api/ContactApi.ts`, `src/pages/ContactPage.ts` are removed and `toolshop.fixture.ts` is neutralised. The agent must rebuild the framework pieces the spec depends on *in addition to* the spec itself.

Every criterion from the `TOOL-2 × api` walkthrough still applies, plus:

| Criterion | Pass example | Fail example |
|---|---|---|
| **API client exists** | `src/helpers/api/ContactApi.ts` exported from `ToolshopApi` with a typed `send(payload)` | `tsc: Cannot find module '@helpers/api/ContactApi'` |
| **Data builder exists** | `src/data/contact.ts` exports a fixture builder (valid defaults + overrides) | `no-hardcoded-data: TC-1 inlines payload literal` |
| **Fixture wired** | `tests/fixtures/toolshop.fixture.ts` exposes `toolshopApi`; spec imports only from `@fixtures` | `eslint: spec must import from @fixtures` |
| **Types from OpenAPI** | request/response types come from generated OpenAPI, not hand-rolled | `tsc: unsafe cast / any` |
| **Framework didn't regress** | `src/types/generated/`, `playwright.config.ts`, ESLint config unchanged | `protected-files: playwright.config.ts was modified` |

With these three tasks (four specs: `TOOL-1 × api`, `TOOL-1 × ui`, `TOOL-2 × api`, `TOOL-3 × ui`) a skill edit produces a `tasks passed: X/4` number plus the per-signal rates below.

### Metrics the run exposes

```
FAIL TOOL-2 api
       ✗ TOOL-2.spec.ts: trace: "Sends message" is not a TC title in TOOL-2
       ✗ parity:statuses: TC-1 never asserts HttpStatus.UNPROCESSABLE_ENTITY
       ✗ run:TC-1: expected 422, got 200

tasks passed: 2/4
judge criteria passed (advisory): 5/9
```

Two numbers are printed; a labelled failure list says *why*. Read them as orthogonal quality signals — a healthy skill scores well on all of them, and a regression usually moves only one or two:

| Quality signal | Reads from | Drops when the agent … |
|---|---|---|
| **Task pass rate** `tasks passed: X/N` | all deterministic gates for every task | writes anything a gate rejects |
| **Convention match** | `eslint`, `ast-grep`, `tsc`, `step-names`, `raw-fixture` | drifts from `AGENTS.md`, rules, or TypeScript types |
| **Traceability** | `trace`, `coverage`, `manual-step-names` | invents titles, doubles up, or skips a manual case |
| **No shortcuts** | `no-disabled-tests`, `bug-marking`, `no-hardcoded-data` | skips a failing test, forgets `test.fail`, inlines a payload |
| **Golden parity** | `parity:statuses`, `parity:assertions` | asserts weaker than the reference (a different valid implementation is fine) |
| **Green execution** | share of `run:TC-n` passing | writes a spec that compiles but never actually verifies the behaviour |
| **Isolation / no backdoor fix** | `protected-files` | edits configs, tools, or other tickets' specs to force green |
| **Judge agreement** (advisory) | share of `judge:TC-n` passing | asserts *something*, but not the thing the test case cares about |

The runner prints one snapshot per invocation. To watch for regression after a skill edit:

- Run the same `tasks` before and after and diff the labelled failures.
- Repeat the live run — agents are non-deterministic. A single flip is noise; a trend is a regression.
- Capture the output yourself (`npm run eval … | tee runs/$(date +%F).txt`); the harness does not keep history.

### What needs a judge

Some questions have no deterministic answer: *does this assertion really verify the expected result?* A test can have the right title, the right annotation, a `200` check and a green run, and still not look at the response body the test case cares about.

That is the one job of the optional LLM judge. The reusable library builds and parses the judge exchange; the concrete `.agents/manual-to-autotests-pipeline/eval/judge.ts` builds one criterion per test case from the manual steps:

```
judge:TC-2  The test verifies each expected result with an assertion that would fail
            if that behaviour were wrong.
            1. Send a 251-character message -> HTTP 422; error names the message field
```

A status-only test should fail this criterion because it never verifies the field-level error. The judge sees the manual cases, generated spec, and golden spec as one valid reference. Its prompt explicitly excludes style, naming, annotations, compilation, and execution because deterministic tools already cover them.

The judge returns `{ id, pass, reason }` verdicts reported as `judge:TC-n`. Calibrate it against the golden outputs before reading its feedback. Rule of thumb: if a check can be code, make it code; use the judge only for the remainder.

### Run the example

| Command | Does |
|---|---|
| `npm run eval -- --golden --no-run` | grade stored golden outputs without an API key; proves the deterministic grader accepts known-good work |
| `npm run eval -- --golden --no-run --verbose` | print every deterministic gate instead of only failed gates |
| `npm run eval -- TOOL-2 --level=api --no-run` | run one live spec-generation task and grade it; requires `CURSOR_API_KEY` |
| `npm run eval -- --golden --no-run --judge --verbose` | print every advisory judge criterion too; requires `CURSOR_API_KEY` and optionally `CURSOR_JUDGE_MODEL` |

Run `npm run test:eval` first, then calibrate with `--golden`. If a golden fails, fix the grader or fixture before evaluating an agent. Omit `--no-run` when the eval should also execute Playwright.

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
