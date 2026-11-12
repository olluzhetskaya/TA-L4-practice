---
name: github-ci
description: Open a pull request with gh and keep the GitHub Actions workflow for the Playwright suite correct — triggers, validate job, api/ui matrix, artifacts. Use when raising a PR, wiring CI, or when CI is red.
---

# github-ci

## Before pushing

```bash
npm run validate          # schemas, typecheck, lint, ast-grep, pipeline gates, harness tests
npm run test:api && npm run test:ui
```

The git pre-push hook (activated by `npm install`) runs `validate` and blocks the push when it is red. Fix the code; never `--no-verify` or add `eslint-disable`.

## Raise the PR

```bash
git checkout -b feature/<TICKET>-<slug>
git add -A && git commit -m "<TICKET>: <what the specs cover>"
git push -u origin HEAD
gh pr create --title "<TICKET>: <title>" --body "Automates TC-1…TC-n. Findings: <list>. Bug-affected: <list or none>."
gh pr checks --watch
```

PR body: test case ids automated, findings and how they were handled, any `test.fail` with its bug reference.

## Workflow `.github/workflows/tests.yml`

- Triggers: `pull_request`, `push` to `main`, weekday `schedule`, `workflow_dispatch`; `concurrency` cancels superseded runs; `permissions: contents: read`.
- `validate`: `npm ci`, `npm run validate` (the same command as the pre-push hook).
- `playwright`: `needs: validate`, matrix `[api, ui]`, `CI=true` (retries 2, 2 workers), browsers installed only for `ui`, HTML report uploaded with `if: always()`.

## When CI is red

1. `gh run view --log-failed` — find the first failing step.
2. Failing gate → reproduce with the same command locally.
3. Failing spec → download the report artifact, open the trace (`npx playwright show-trace`). Decide: product change (update artifact + spec), product bug (`test.fail` with reason), or flake (see `test-stability`).
