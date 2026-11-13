# Gate flow

## One Cursor request

```mermaid
flowchart TD
    A["User supplies manual test JSON + story"] --> B["automate-test-case skill"]
    B --> C["Save inputs"]
    C --> D["validate:pipeline --progress"]
    D -->|fail| C
    D -->|pass| E["Explore the live SUT"]
    E --> F["Write exploration artifact"]
    F --> G["validate:pipeline --progress"]
    G -->|fail| E
    G -->|pass| H["Generate API/UI specs and framework code"]
    H --> I["validate:pipeline TICKET"]
    I -->|fail| H
    I -->|pass| J["Run targeted Playwright specs"]
    J -->|fail| H
    J -->|pass| K["npm run validate"]
    K -->|fail| H
    K -->|pass| L["Agent finishes"]
    L --> M["Cursor stop hook"]
    M --> N["validate.ts --hook"]
    N -->|domain gate fails| O["Follow-up message to agent"]
    O --> H
    N -->|pass| P["Turn stops successfully"]
```

The stop hook retries at most three times. It runs the custom pipeline gates only; the skill runs targeted Playwright and full `npm run validate` before reporting completion.

## What `validate:pipeline` checks

```mermaid
flowchart LR
    A["Manual inputs"] --> B["Input gates"]
    B --> C["Exploration artifact"]
    C --> D["Exploration gates"]
    D --> E["Generated specs"]
    E --> F["Spec gates"]

    B --- B1["Zod schema<br/>ticket/file match<br/>story + AC references<br/>concrete expected results<br/>API/UI level coverage<br/>test strategy"]
    D --- D1["Zod schema<br/>known TC references<br/>evidence for every TC<br/>semantic UI locators<br/>observed API calls"]
    F --- F1["manual title + TC annotation<br/>correct API/UI level<br/>manual-action test.step<br/>no missing test.step<br/>no raw page/request fixture<br/>no hardcoded test data<br/>exactly one spec per TC<br/>no orphan spec"]
```

- `--progress`: validates what exists without demanding the complete final output.
- Default/`--hook`: requires the exploration artifact and complete test-case coverage.
- Failures are named and returned to the agent as actionable follow-up text.

## Full repository validation

`npm run validate` runs these in order:

```mermaid
flowchart LR
    A["schema:check"] --> B["tsc"]
    B --> C["ESLint"]
    C --> D["ast-grep"]
    D --> E["validate:pipeline"]
    E --> F["harness unit tests"]
```

- **Schema check:** committed JSON Schema exports still match the Zod schemas.
- **TypeScript:** framework and harness compile.
- **ESLint:** TypeScript/Playwright rules and specs importing only from `@fixtures`.
- **ast-grep:** local forbidden code shapes such as fixed waits, inline timeouts, direct navigation/locators, weak response checks, empty steps, and status literals.
- **Pipeline:** input, exploration, traceability, fixture-injection, test-data, and coverage gates.
- **Harness tests:** passing and failing examples for the custom gates and ast-grep rules.

Playwright execution is separate from `npm run validate`.

## When each entry point runs

```mermaid
flowchart TD
    A["Cursor skill"] --> A1["progress gates"]
    A --> A2["complete pipeline gates"]
    A --> A3["targeted Playwright"]
    A --> A4["npm run validate"]

    B["Cursor stop hook"] --> B1["complete pipeline gates"]

    C["git push"] --> C1["pre-push: npm run validate"]

    D["GitHub Actions"] --> D1["npm run validate"]
    D1 --> D2["API Playwright job"]
    D1 --> D3["UI Playwright job"]

    E["Eval command"] --> E1["shared spec gates"]
    E1 --> E2["ESLint + ast-grep + tsc"]
    E2 --> E3["eval-only deterministic checks"]
    E3 --> E4["optional Playwright run"]
    E3 --> E5["optional advisory LLM judge"]
```

## Eval additions

Reusable task execution, command gates, judge parsing, and Playwright report parsing live in `.agents/lib/eval/`. The concrete spec dataset, workspace builder, graders, and rubric live in `.agents/manual-to-autotests-pipeline/eval/`.

The concrete eval reuses the normal spec gates, then adds:

- no disabled tests;
- correct `test.fail` use for known product gaps;
- parity with golden HTTP statuses and assertion strength;
- protected-file checks;
- optional per-test-case Playwright execution;
- optional advisory assertion-quality judge.

The judge never changes deterministic pass/fail.
