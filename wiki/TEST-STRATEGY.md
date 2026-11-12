# Test Strategy

Applies to every story automated by this pipeline. The agent reads this file **before** it analyses the SUT or writes any spec. Section numbers are cited by gates and skills — keep them stable.

## 1. Core principle

No flow is fully covered by a single test level. API tests and UI tests are complementary, not interchangeable. Anything a user does through a form, button, or dialog must be exercised in the UI at least once, however thoroughly the same rule is checked at the API.

## 2. Test levels

### Level 1 — API

Owns:

- Request/response contract: required fields, error body shape, HTTP status codes
- Validation rules, boundary values, and negative paths
- Data permutations that are slow or fragile through the UI
- Persistence: create, then read back and compare

Does not own: whether a button is enabled, what a validation message looks like, how a form behaves.

### Level 2 — UI

Owns:

- What the user sees and can do: labels, validation messages, confirmations, enabled/disabled state
- Client-side rules that never reach the server (e.g. a form's minimum message length)
- One happy-path journey per user-facing action

Does not own: exhaustive input permutations — those belong to the API level.

## 3. UI coverage rule

For every API test that covers a user-facing action there is a UI test for the same action, and the other way around. A rule enforced only in the browser is tested in the UI; a rule enforced only by the service is tested at the API. When the manual test case assigns a rule to the wrong level, the SUT analysis records it as a finding and the spec follows the live behaviour.

## 4. API as setup

Preconditions are created through the API (or reached by the fixture), never by driving the UI. The browser is opened only for what the test case asserts on.

## 5. The manual test case defines scope

The manual test case decides what a spec covers and what it is called. The pipeline does not add, merge, or rename test cases. Where the live SUT contradicts a test case step, the spec asserts the observed behaviour or records an annotated gap — it never weakens an assertion silently.

## 6. Contracts come from the live SUT

Status codes, field names, and validation messages written in a manual test case are design-time guesses. The SUT analysis fires real requests and records what the system actually does; specs are written against that record.

## 7. Spec conventions

- Test title = test case title. Annotation `testCase('TC-n')` links back to the manual case.
- Steps are named `Verify that …` or `Confirm that …` — business outcome, not UI action.
- Assertions are auto-retrying and carry a message. Expected values come from data records, enums, or API responses — never ad-hoc literals.
- Locators live in page objects, are semantic (`getByRole`, `getByLabel`, …), and are never CSS.
- Specs import only from `@fixtures`.

## 8. Sign-off checklist

- Every manual test case has exactly one automated test (or a documented `test.fixme`).
- Every API test of a user-facing action has a UI counterpart, and vice versa.
- Lint, ast-grep, and the pipeline gates pass.
- The suite is green locally and in CI.
