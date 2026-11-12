/**
 * Single source of truth for the pipeline. The stop hook, `npm run runGates`, CI,
 * the evals, and the README task sheet all read the stages from here.
 */
import type { CheckResult } from '../lib/gates/gateResults.ts'
import { DIRS, FILE_PATTERNS, PIPELINE_DIR } from '../harness-config.ts'
import { listFiles } from '../lib/files.ts'
import { reviewInputFile } from './input-validation/review-input-files.ts'
import { reviewExplorationFile } from '../skills/analyse-sut/scripts/review-exploration-file.ts'
import { reviewSpecFile } from './specs-validation/review-spec-file.ts'

/** `lint: false` skips the eslint/ast-grep command gates (validate:push runs them once, globally). */
export type ReviewOpts = { root: string; lint?: boolean }

export type Stage = {
  id: 'input' | 'analyse-sut' | 'specs'
  /** Repo-relative posix path predicate: which files this stage's hook owns. */
  owns: RegExp
  /** Where to look when reviewing every file (`--all`). */
  list: (root: string) => string[]
  review: (file: string, opts: ReviewOpts) => CheckResult
  /** Appended to the follow-up message the agent receives when a gate fails. */
  followupRules: string[]
}

const { generated: GENERATED } = FILE_PATTERNS

export const STAGES: Stage[] = [
  {
    id: 'input',
    owns: new RegExp(`^${PIPELINE_DIR}/test-cases/[^/]+\\.json$`),
    list: root => listFiles(root, DIRS.testCases, /\.json$/),
    review: (file, { root }) => reviewInputFile(file, { root }),
    followupRules: [
      '- Test cases are a Jira/Xray export: key TC-n, one component api|ui, AC-n labels, a link to the story, steps with action/data/"expected result".',
      '- "expected" must be concrete enough to assert on — never "works" or "correct".',
      '- wiki/TEST-STRATEGY.md must exist before analysis starts.',
    ],
  },
  {
    id: 'analyse-sut',
    owns: new RegExp(`^${PIPELINE_DIR}/artifacts/explore-[^/]+\\.json$`),
    list: root => listFiles(root, DIRS.artifacts, /explore-[^/]+\.json$/),
    review: (file, { root }) => reviewExplorationFile(file, { root }),
    followupRules: [
      '- Locators are semantic getBy* expressions probed on the live page — never CSS, XPath, or placeholders.',
      '- uiLabel is the rendered text; it must differ from the test case wording (tcAction).',
      '- apiCalls[].observed records live pre-flight results; findings record where the SUT differs from the test case.',
      '- Every test case needs a scenario at its own level.',
    ],
  },
  {
    id: 'specs',
    owns: /^(src|tests)\/.+\.ts$/,
    list: root =>
      [...listFiles(root, 'tests', /\.ts$/), ...listFiles(root, 'src', /\.ts$/)].filter(
        f => !GENERATED.test(f) && !f.endsWith('.d.ts'),
      ),
    review: (file, { root, lint }) => reviewSpecFile(file, { root, lint }),
    followupRules: [
      '- Spec titles are the manual test case titles; each test has annotation: testCase("TC-n").',
      '- Steps read "Verify that …" / "Confirm that …"; expect() carries a message; no page.goto or locators in specs.',
      '- Fix lint errors in the code — never add eslint-disable comments.',
    ],
  },
]

export const stageFor = (relPath: string): Stage | undefined =>
  STAGES.find(stage => stage.owns.test(relPath) && !GENERATED.test(relPath))
