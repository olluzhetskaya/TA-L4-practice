# Attach to a paused test / inspect a trace.zip

These are **not** the same as `playwright-cli tracing-start` (live CLI recording).

When/why and `--project`: .

## Paused test (`--debug=cli`)

Forces headed, one worker, no test timeout. Always pass `--project=api` or `--project=ui`.

```bash
npx playwright test tests/client/specs/sms/sms-manager-moderation-e2e.spec.ts --project=test-client --debug=cli
```

Stdout prints a session id (`tw-…`). Attach, then snapshot or step:

```bash
playwright-cli attach tw-87b59e
playwright-cli --session=tw-87b59e snapshot --filename=debug-state.yml
playwright-cli --session=tw-87b59e step-over
playwright-cli --session=tw-87b59e resume
playwright-cli --session=tw-87b59e detach
```

`pause-at <location>` runs until that source location, then pauses.

## Saved test trace (`npx playwright trace`)

Config keeps `trace: 'retain-on-failure'`. Files: `test-results/**/trace.zip`.

```bash
npx playwright trace open test-results/<folder>/trace.zip
npx playwright trace errors
npx playwright trace actions --errors-only
npx playwright trace actions --grep="expect"
npx playwright trace action 9
npx playwright trace snapshot 9 --phase after
npx playwright trace requests --failed
npx playwright trace console
npx playwright trace close
```

1.63 snapshot flag is `--phase before|action|after`, not `--name`. Resume is `resume`, not `continue`.
