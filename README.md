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
| **Skills** (`.agents/skills/<name>/SKILL.md`) | the agent's recipes: plain Markdown with a short front-matter description, so they are **tool-agnostic**. Any agent that reads `SKILL.md` files can use them; Cursor finds them through the `.cursor/skills` symlink to `.agents/skills`, another tool needs its own symlink or path |
| **[Cursor](https://cursor.com) agent and [hooks](https://cursor.com/docs/hooks)** | the agent writes the code; `.cursor/hooks.json` runs the gates automatically (Phase 5). This part is **Cursor-specific**; the gates it calls (`runGates`) are not |
| **[git hooks](https://git-scm.com/docs/githooks)** (`git config core.hooksPath`) | enforce pre-commit and pre-push checks for every contributor, not just the agent |
| **[git](https://git-scm.com)** + **[GitHub Actions](https://docs.github.com/actions)** + **[`gh` CLI](https://cli.github.com)** | version control, CI that keeps it green (Phase 7), and opening the PR (Phase 6) |

## How to use this repo

This repo is a complete, working example — the finished pipeline, all gates green, goldens verified against the live system. It is not a framework to extend or a starter to generate from; it's a worked reference. Read it to see how each phase is solved, then build the same pipeline in a project of your own by following the phases below.

Run `npm install && npx playwright install chromium`. Copy `.env.example` to `.env`.

Each phase below has the same shape: **Why** (what goes wrong without it), **Example** (a concrete before/after), **Build** (what to create), **Acceptance** (a command that must pass before you move on).

## What you are given

| Given | Where |
|---|---|
| Story + manual test cases for `TOOL-1` (contact form) | `.agents/manual-to-autotests-pipeline/stories/TOOL-1.md`, `.../test-cases/TOOL-1.json` |
| Test strategy the agent must follow | `wiki/TEST-STRATEGY.md` |
| Framework core: config, typed API base client, `BasePage`, fixtures, tags, `readJson`, generated OpenAPI types | `src/`, `tests/fixtures/`, `playwright.config.ts` |
| Supporting skills the spec skills delegate to: `playwright-cli`, `probe-sut`, `create-locators`, `pom-builder`, `data-layer`, `test-data-state-management`, `test-stability`, `playwright-annotations`, `typescript-types`, `architecture-best-practices`, `code-review`, `github-ci` | `.agents/skills/` |
| Coding conventions (enforced by ESLint) | `AGENTS.md`, `eslint.config.mjs` |

You build everything else. The harness is split in two on purpose: `.agents/lib/` is generic (gates, eval framework — it knows nothing about this pipeline) and `.agents/manual-to-autotests-pipeline/` is the concrete pipeline built on it. A different pipeline could reuse `lib/` unchanged.

## Phase 0 — ADR

**Why.** An agent pipeline has many moving parts (stages, artifacts, gates, hooks). Without a written design, each part gets decided ad hoc while coding, and nobody can say later why a gate exists or what is deliberately left out. Writing the decision down first is also the cheapest place to discover a bad idea.

**Example.** The ADR in this repo weighs three options and rejects two, with a reason each:
- *One prompt, one pass* ("write a test for this case") — cheapest, but there are no contracts and no feedback loop, so failures only show up in review.
- *Record-and-replay / codegen only* — stable locators, but no assertions derived from intent, no API tests, no traceability.
- *Pipeline of skills with deterministic gates between stages* (chosen) — more to build, but every defect is caught at the stage that causes it.

**Build.** Copy `docs/adr/TEMPLATE.md` to `docs/adr/0001-agentic-test-automation-pipeline.md` and decide, before writing code: stages, artifacts and their formats, what each gate checks, who owns what, what is out of scope, how you will know it works. Name at least two rejected options.

*Acceptance:* a reviewer can implement the pipeline from the ADR alone.

## Phase 1 — Input and input hook

**Why.** Everything downstream trusts the test cases. A vague expected result ("it works") cannot become an assertion, and a dangling requirement link means a test nobody can trace. Catching this at the door costs one failing command; catching it after the spec is written costs a rewrite.

**Example.** The input is a manual test case in JSON plus an optional Jira user story (JSON or Markdown). A test case with `"expected": "works correctly"` is rejected by `concrete-expected` (`expected result is too vague to assert on: …`); a case that references `AC-9` when the story only has `AC-1`..`AC-3` is rejected by `ac-refs` (`acRefs not found in the story: AC-9`).

This is also where the harness is born. You can't check anything without a way to express a result and a way to run it, so build the minimal core here and immediately point it at `TOOL-1.json`. Later phases grow the harness next to the first thing that needs each piece — no big framework up front.

**Build** the gate core, then the first gate on top of it:

- `.agents/lib/gates/gateResults.ts` — the shared result vocabulary: `pass` / `warn` / `fail` returning `{ gate, status, detail }`, and a `CheckResult` that aggregates gates into a `fix_required` / `continue` decision (any `fail` blocks). Everything downstream reuses this. *Why:* one vocabulary means the hook, the CLI, CI and the evals all read results the same way.
- `.agents/harness-config.ts` — paths, timeouts and file patterns in one place, so no gate hard-codes a directory.
- `.agents/manual-to-autotests-pipeline/pipeline.config.ts` — a stage registry (`STAGES`); start with a single `input` stage that owns `test-cases/*.json` and names its `review` function. This is the single source of truth the CLI, hooks, and CI read as you add stages.
- `.agents/scripts/runGates-cli.ts` — routes a file to its stage's `review` and exits non-zero on a failing gate. Start with `--all` / `--stage` / `--json`; the `--hook`, `--ci`, `--no-lint`, `--with-tests` flags come when later phases need them.
- `.agents/manual-to-autotests-pipeline/input-validation/` — `input-schemas.ts` and `review-input-files.ts`, the schema and the gates that run on it.

Then the input validation itself:

- Define the Zod schema for a manual test case file: ticket, test cases (`TC-n` id, title, `api|ui` level, priority, AC references, preconditions, steps with action / data / expected).
- Schema conventions — make the schema itself reject bad data so the gates have less to do:
  - **Fixed sets are `z.enum`, never free strings.** `level` is `['api','ui']`, `priority` and any status are closed enums — an invented `"P0"` or `"apiiii"` fails parsing instead of flowing downstream. Statuses map to the shared `HttpStatus`, not ad-hoc numbers.
  - **Objects are `.strict()`.** A typo'd or unknown key (`expectedd`, `acRef`) is an error, not silently dropped.
  - **Constrain shape, not just type.** Non-empty strings (`.min(1)`), id patterns via `.regex` (`TC-\d+`, `AC-\d+`) — so a blank title or a malformed id is caught by the schema, not a hand-written gate.
  - **Required by default; optionality is explicit.** Only `.optional()` what is truly optional (the story); everything else must be present.
  - **Allow `null` for genuinely-unknown values so the agent never invents one.** A field the agent may not know yet (e.g. `preconditions`, an AC ref that doesn't apply) is `.nullable()` — an honest `null` is valid and distinct from a fabricated string or a dropped key. Reserve `.optional()` for "key may be absent", `.nullable()` for "value is explicitly none".
  - **One source of truth.** Derive the TS type with `z.infer`, reuse shared enums/sub-schemas across files instead of re-declaring, and parse with `safeParse` — never a cast or `any`.
- Story is optional: Markdown or JSON; when present, AC references in test cases must resolve to it.
- Gates: schema · ticket matches file name · AC refs resolve · every `expected` is concrete (reject "works", "correct") · `wiki/TEST-STRATEGY.md` exists. Missing story = warn, not fail.
- `npm run schema` exports the Zod schemas as JSON Schema (`*.schema.json`) so editors and the agent can read the contract without running code.

*Acceptance:* `npm run runGates -- .agents/manual-to-autotests-pipeline/test-cases/TOOL-1.json` passes; a copy with a vague `expected` or an unknown `AC-9` fails with a message an agent can act on. Write a passing and a failing fixture per gate (`node:test`).

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

Gate ideas, one named gate per failure mode so the agent knows what to fix: schema · locator is semantic, not CSS/XPath or a placeholder · every reference (locator, call, finding) resolves · every test case has a scenario at its level · every API call has at least one live observation.

*Acceptance:* a hand-made reference for `TOOL-1` passes your gates; mutated copies (placeholder locator, dangling reference, missing scenario, API call without observations) each fail a *different* named gate. Then run the skill on `TOOL-1` and get an artifact that passes.

## Phase 3 — Spec skills and spec gates

**Why.** A skill is the recipe that makes the agent's output consistent from run to run; the gates are what makes it *checkable*. Without traceability gates, an agent can write plausible tests that map to no manual test case (scope creep) or skip one (silent gap).

**Example.** The agent writes `test('contact form works', …)` with no annotation. The `tc-trace` gate fails: `"contact form works" is not a test case title in TOOL-1`. After the fix the test is titled `Verify that a visitor can send a message through the contact form` (the manual title, verbatim) and carries `annotation: testCase('TC-3')`, which links it back to the manual test case.

**Build** `.agents/skills/create-api-spec/SKILL.md`, `.agents/skills/create-ui-spec/SKILL.md`, and the specs stage in `.agents/manual-to-autotests-pipeline/specs-validation/`.

This stage is the first that runs external tools as gates, so build the piece of harness that enables it:

- `.agents/lib/gates/commandGate.ts` — wraps any CLI as a gate: exit 0 = pass, otherwise fail with the tail of the output so the agent can act on it verbatim. The spec review (`review-spec-file.ts`) uses it to run eslint and ast-grep as gates; CI, the pre-push runner and the evals reuse it later.
- the traceability gates themselves (`spec-gates.ts`), registered as a `specs` stage in `STAGES`.

Skills are generic: no Toolshop endpoints inside. Keep them short by **delegating** to the supporting skills (each step names the skill to read) instead of repeating their rules. They must say how to map each finding to an assertion, reuse before creating, where data/POM/fixtures live, and how to verify (`runGates`, `playwright test`).

Spec gates for `*.spec.ts`: title = test case title · `testCase('TC-n')` annotation per test · step names start `Verify that` / `Confirm that` · every test case of that level is covered (warn, so a split across files stays legal).

*Acceptance:* `npm run test:harness` covers each gate. Running the skills on `TOOL-1` produces `tests/api/TOOL-1.*.api.spec.ts` and `tests/ui/TOOL-1.*.ui.spec.ts` that pass the hook.

## Phase 4 — Lint and ast-grep rules

**Why.** Style rules written in a prompt are suggestions the agent forgets under pressure. A rule that fails the build is a fact. ESLint covers what the type system can see; ast-grep covers code *shapes* (a call with a literal argument, a method chain) that are awkward to express in ESLint.

**Example.** A spec contains `await page.goto('/contact')` and `expect(response.status()).toBe(200)`. `no-goto-in-spec` points at the first line (navigation belongs in a page object) and `no-status-literal-in-assert` at the second (use `HttpStatus.OK`). The agent fixes both from the message; nobody reviews it by hand.

**Build** the rules the agent must obey. ESLint is configured; write ast-grep rules in `tools/ast-grep/rules/` for each of these, each with a bad and a good fixture:

| Rule | Why |
|---|---|
| no `page.goto` / `page.locator` in specs | navigation and locators belong in page objects |
| no status-code or URL literals in specs / API clients | enums and config own them |
| `expect` carries a message | failures must explain themselves |
| no `.nth(0)`, no `.then()` chains, no inline magic timeouts | stability |
| no `APIRequestContext` outside an API client | layering |
| no deep relative imports | path aliases |
| every `test()` contains a `test.step` | report readability |

Rule of thumb: if a rule is about *what a call looks like*, it is an ast-grep rule; if it is about *types or imports*, it is ESLint. Fix lint errors, never suppress them (`eslint-disable` is itself an error).

*Acceptance:* `npm run ast-grep` and `npm run lint` pass on clean code and fail on each bad fixture (`specs-validation/ast-grep-rules.test.ts` runs them).

## Phase 5 — Wire the hooks

**Why.** Gates that only run when someone remembers to run them protect nothing. Hooks make the checks part of the workflow: the agent is corrected the moment it finishes a turn, and a red push can't leave the machine.

**Example.** The agent leaves a `page.waitForTimeout(2000)` in a spec and says "done". The stop hook runs, the `no-manual-sleep` rule fails, and the agent receives a follow-up message: *fix `tests/ui/TOOL-1.contact.ui.spec.ts`, use an auto-retrying assertion*. You did not type anything.

This phase needs one more harness piece before the hooks can call them:

- `.agents/scripts/pre-push-hook.ts` — runs `npm run validate:push` and returns a block/allow decision.

**Build** `.cursor/hooks.json` and activate the git hooks with `npm run hooks:install`.

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

Because the input is fixed, you know exactly what a correct output must contain, so almost everything can be a plain check. Each check below is a small pure function over one shared context (`eval/spec-checks.ts`); a failing check names the thing to fix.

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

- **One criterion per test case**, e.g. *"The test annotated `testCase('TC-2')` verifies each expected result below with an assertion that would fail if that behaviour were wrong. Skipped results, loosened conditions and weak matchers fail this criterion."* plus the manual steps.
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
