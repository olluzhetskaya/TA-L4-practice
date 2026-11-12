---
name: automate-test-case
description: Automates supplied manual test cases end to end: save the input, inspect the live application, write the exploration artifact, generate API and UI Playwright specs, and verify them. Use when the user asks to automate a test case and provides manual test JSON or a story.
---

# Automate a test case

This is the entry point for one natural-language request. Sequence the existing stage skills; do not replace their instructions or invent another orchestrator.

## Workflow

1. Identify the story ticket from the test-case JSON.
2. Save the supplied inputs:
   - manual JSON unchanged at `.agents/manual-to-autotests-pipeline/test-cases/<TICKET>.json`
   - story at `.agents/manual-to-autotests-pipeline/stories/<TICKET>.md|json`
3. Run `npm run validate:pipeline -- --progress <TICKET>`. Fix invalid input before continuing.
4. Read and follow `analyse-sut`. Do not generate code until its live exploration artifact passes progress validation.
5. Read the normalized test cases:
   - if any have level `api`, follow `create-api-spec`
   - if any have level `ui`, follow `create-ui-spec`
6. Run `npm run validate:pipeline -- <TICKET>`.
7. Run the targeted API and UI Playwright specs generated for the ticket.
8. Run `npm run validate`.

Do not report completion while a command in steps 6–8 fails. If live access, authentication, or required input is unavailable, report that blocker instead of inventing evidence.
