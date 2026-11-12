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
  specFile: /\.spec\.ts$/,
  /** Spec file with a level suffix: `TOOL-1.contact.api.spec.ts`. */
  specLevel: /\.(api|ui)\.spec\.ts$/,
  /** Ticket id at the start of a file name (with optional `explore-` prefix). */
  ticketAtStart: /^(?:explore-)?([A-Z][A-Z0-9]+-\d+)/,
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

export const TIMEOUTS = {
  /** eslint / ast-grep over the written specs. */
  style: 120_000,
  /** tsc --noEmit inside an eval workspace. */
  tscCheck: 180_000,
  /** playwright test inside an eval workspace. */
  playwright: 600_000,
} as const
