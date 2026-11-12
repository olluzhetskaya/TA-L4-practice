---
name: code-review
description: Review generated specs, page objects, API clients, and fixtures against this framework's standards and report severity-rated findings. Use as the last step before a PR, or when asked to review test code. Lint and ast-grep catch the mechanical rules; this covers what they cannot.
---

# code-review

Run the gates first — they are the floor, not the review:

```bash
npm run runGates -- <changed files>
```

Then read the code for what tools miss. Report **Critical** (must fix), **Warning**, **Info**; fix every Critical before the PR.

## Critical

- Spec title or `testCase()` does not match a manual test case; a test case is missing or duplicated.
- An assertion was loosened to make a test pass (a status widened, a value dropped) instead of `test.fail(true, 'BUG: …')`.
- Assertion that cannot fail: compares a value to itself, asserts an array is defined, awaits nothing.
- Test depends on data it did not create, or on another test's side effects.
- Locator not backed by the analyse-sut artifact, or an index/CSS fallback.
- Layering breach: locator or URL in a spec, assertion in a page object, `request` outside an API client.

## Warning

- Inline derivation in an assertion (`length - 1`, string concatenation) instead of a named data value.
- A step name that describes UI actions (`Click Send`) rather than a business outcome (`Verify that …`).
- A fixture that does more than one thing, or a fixture used by one test only.
- Duplicate builder / helper that already exists in `src/`.
- A comment that restates the code.

## Info

- Naming, ordering, import grouping.

## Report format

```
Score: 0–100 (start 100; −15 Critical, −5 Warning, −1 Info)
🔴 <file>:<line> <finding> — <fix>
🟡 …
```
