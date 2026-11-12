---
name: playwright-annotations
description: Tags, test-case links, and expected-failure annotations in Playwright specs — test.fail vs test.fixme vs test.skip, and how a known product bug is recorded without loosening the assertion. Use when tagging a test, linking a manual test case, or marking a test affected by a bug.
---

# playwright-annotations

## Every test

```typescript
test('<test case title>', { tag: [Tag.Api, Tag.Regression], annotation: testCase('TC-2') }, async ({ … }) => { … })
```

- `Tag` enum from `@fixtures` (`@api`/`@ui` = level, `@smoke`/`@regression` = suite). No string tags.
- `testCase('TC-n')` is the traceability link; the spec gate requires it and the HTML report shows it.

## Which marker for which situation

| Situation | Marker | Behaviour |
|---|---|---|
| Product bug: the system violates the acceptance criterion | `test.fail(true, 'BUG: <what, where>')` as the first line in the body | Runs; **passes while the bug exists**, goes red when someone fixes it — signal to remove the marker |
| Feature not built / test not ready, cannot run meaningfully | `test.fixme(true, 'reason + ticket')` | Not run |
| Wrong environment (browser, platform) | `test.skip(condition, 'reason')` | Not run |
| Slow by nature | `test.slow()` | Triples the timeout |

Rules:

- A bug-affected case gets its **own** `test()` so the rest of the ticket keeps guarding. Never wrap a step in try/catch to survive a bug.
- Keep the assertion the acceptance criterion demands. `test.fail` is the only allowed concession (`annotate-gap` finding).
- The reason names the symptom and where it was observed, e.g. `BUG: 500 for names of 100+ characters; AC-1 allows 120`.
- Conditional markers use a named condition, not an inline environment check.
- A `fixme`/`skip` without a reason string is a lint failure waiting to happen; always give one.
