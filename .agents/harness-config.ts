/** Pipeline paths, timeouts, and output-size constants for the harness. */

export const PIPELINE_DIR = '.agents/manual-to-autotests-pipeline'

export const DIRS = {
  stories: `${PIPELINE_DIR}/stories`,
  testCases: `${PIPELINE_DIR}/test-cases`,
  artifacts: `${PIPELINE_DIR}/artifacts`,
  evalSkeleton: `${PIPELINE_DIR}/eval/skeleton`,
  evalDataset: `${PIPELINE_DIR}/eval/dataset`,
} as const

export const PATHS = {
  strategyFile: 'wiki/TEST-STRATEGY.md',
  testCasesSchema: `${PIPELINE_DIR}/input-validation/test-cases.schema.json`,
  storySchema: `${PIPELINE_DIR}/input-validation/story.schema.json`,
  explorationSchema: '.agents/skills/analyse-sut/references/exploration.schema.json',
} as const

export const FILE_PATTERNS = {
  /** Any Playwright spec file. */
  specFile: /\.spec\.ts$/,
  /** Spec file with a level suffix: `TOOL-1.contact.api.spec.ts`. */
  specLevel: /\.(api|ui)\.spec\.ts$/,
  /** Ticket id at the start of a file name (with optional `explore-` prefix). */
  ticketAtStart: /^(?:explore-)?([A-Z][A-Z0-9]+-\d+)/,
  /** Paths excluded from stage ownership: generated code and vendored modules. */
  generated: /(^|\/)(generated|node_modules)\//,
} as const

/** Files an eval agent must leave byte-identical: weakening any of them would make the gates pass dishonestly. */
export const EVAL_PROTECTED = {
  files: ['playwright.config.ts', 'tsconfig.json', 'eslint.config.mjs', 'package.json'],
  dirs: ['tools', '.agents'],
} as const

export const VALIDATION = {
  /** Minimum character length for a step `expected` value to be considered concrete. */
  minExpectedLength: 8,
} as const

/** Timeout and output-size constants for harness gates and scripts. */

export const TIMEOUTS = {
  /** Default for commandGate when callers omit timeoutMs. */
  defaultGate: 120_000,
  /** npx tsc --noEmit inside an eval workspace. */
  tscCheck: 180_000,
  /** npx playwright test — CI, eval grading, and runTests. */
  playwright: 600_000,
  /** One eval task: agent run + grading (long — agent may take several minutes). */
  evalTask: 20 * 60_000,
} as const

export const MAX_DETAIL_LINES = {
  /** Default for commandGate when callers omit maxDetailLines. */
  defaultGate: 12,
  /** Playwright run in CI mode. */
  playwright: 25,
} as const
