import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { listFiles, readOutputJson } from '../../lib/files.ts'
import { testCaseFileSchema, type TestLevel } from '../input-validation/input-schemas.ts'
import { artifactPath, storyMdPath, testCasePath } from '../paths.ts'
import { DIRS, FILE_PATTERNS } from '../../harness-config.ts'
import { levelFromSpecName } from '../specs-validation/spec-source.ts'
import { FEATURE_FILES, NEUTRALISED_FILES, REFERENCE_TICKET } from './skeleton.ts'

const datasetDir = (repoRoot: string) => join(repoRoot, DIRS.evalDataset)

/** One eval ticket: inputs the pipeline starts from and the golden outputs to compare against. */
export type EvalItem = {
  ticket: string
  /** `skeleton`: feature code removed, the agent builds everything. `full`: the agent extends the finished reference. */
  base: 'skeleton' | 'full'
  testCases: string
  story: string
  /** Golden analyse-sut artifact (also the input of the spec tasks). */
  artifact: string
  /** Golden files by repo-relative path — specs plus the support code they need. */
  golden: Record<string, string>
  levels: TestLevel[]
}

export const goldenSpecs = (item: EvalItem, level?: TestLevel): string[] =>
  Object.keys(item.golden).filter(rel => rel.endsWith('.spec.ts') && (!level || levelFromSpecName(rel) === level))

function levelsOf(testCasesFile: string): TestLevel[] {
  const raw = readOutputJson(testCasesFile)
  if (!raw.ok) throw new Error(`${testCasesFile}: ${raw.detail}`)
  const parsed = testCaseFileSchema.parse(raw.raw)
  return [...new Set(parsed.testCases.map(tc => tc.level))].sort((a, b) => a.localeCompare(b))
}

function referenceItem(repoRoot: string): EvalItem {
  const golden: Record<string, string> = {}
  for (const rel of [...FEATURE_FILES, ...NEUTRALISED_FILES]) golden[rel] = join(repoRoot, rel)
  for (const rel of [...listFiles(repoRoot, 'tests/api', FILE_PATTERNS.specFile), ...listFiles(repoRoot, 'tests/ui', FILE_PATTERNS.specFile)])
    if (rel.includes(`/${REFERENCE_TICKET}.`)) golden[rel] = join(repoRoot, rel)
  const testCases = join(repoRoot, testCasePath(REFERENCE_TICKET))
  return {
    ticket: REFERENCE_TICKET,
    base: 'skeleton',
    testCases,
    story: join(repoRoot, storyMdPath(REFERENCE_TICKET)),
    artifact: join(repoRoot, artifactPath(REFERENCE_TICKET)),
    golden,
    levels: levelsOf(testCases),
  }
}

function datasetItem(repoRoot: string, ticket: string): EvalItem {
  const dir = join(datasetDir(repoRoot), ticket)
  const golden: Record<string, string> = {}
  for (const rel of listFiles(dir, 'golden', /./)) golden[rel.replace(/^golden\//, '')] = join(dir, rel)
  const testCases = join(dir, 'test-cases.json')
  return {
    ticket,
    base: 'full',
    testCases,
    story: join(dir, 'story.md'),
    artifact: join(dir, 'explore.json'),
    golden,
    levels: levelsOf(testCases),
  }
}

/** The reference ticket (skeleton base) followed by every ticket under `eval/dataset/`. */
export function loadEvalItems(repoRoot: string): EvalItem[] {
  const dir = datasetDir(repoRoot)
  const extra = existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .sort((a, b) => a.localeCompare(b))
    : []
  return [referenceItem(repoRoot), ...extra.map(ticket => datasetItem(repoRoot, ticket))]
}
