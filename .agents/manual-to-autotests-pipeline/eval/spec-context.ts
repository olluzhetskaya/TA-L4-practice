import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { listFiles, readOutputJson } from '../../lib/files.ts'
import { explorationSchema } from '../../skills/analyse-sut/scripts/schema.ts'
import { testCaseFileSchema, type ManualTestCase, type TestLevel } from '../input-validation/input-schemas.ts'
import { testCasePath } from '../paths.ts'
import { readTestBlocks } from '../specs-validation/spec-source.ts'
import { goldenSpecs, type EvalItem } from './dataset.ts'

/** Everything a check needs to know about one written spec set, read once. */
export type SpecContext = {
  item: EvalItem
  level: TestLevel
  workspace: string
  specFiles: string[]
  source: string
  /** Source of each annotated test, keyed by test case id. */
  blocks: Map<string, string>
  goldenSource: string
  goldenBlocks: Map<string, string>
  /** Manual test cases of this level. */
  testCases: ManualTestCase[]
  /** Test cases the golden analysis recorded as hitting a product bug. */
  bugCaseIds: Set<string>
}

const readFiles = (files: string[], resolve: (file: string) => string | undefined): string =>
  files.flatMap(file => {
    const abs = resolve(file)
    return abs ? [readFileSync(abs, 'utf8')] : []
  }).join('\n')

function readTestCases(item: EvalItem, level: TestLevel, workspace: string): ManualTestCase[] {
  const raw = readOutputJson(join(workspace, testCasePath(item.ticket)))
  return raw.ok ? testCaseFileSchema.parse(raw.raw).testCases.filter(tc => tc.level === level) : []
}

function readBugCaseIds(item: EvalItem, testCases: ManualTestCase[]): Set<string> {
  const raw = readOutputJson(item.artifact)
  const exploration = raw.ok ? explorationSchema.safeParse(raw.raw) : undefined
  const ids = new Set(testCases.map(tc => tc.id))
  const bugs = (exploration?.success ? exploration.data.findings : [])
    .filter(finding => finding.resolution === 'annotate-gap' && ids.has(finding.tcRef))
    .map(finding => finding.tcRef)
  return new Set(bugs)
}

export function buildSpecContext(item: EvalItem, level: TestLevel, workspace: string): SpecContext {
  const specFiles = listFiles(workspace, `tests/${level}`, new RegExp(`/${item.ticket}\\.[^/]+\\.${level}\\.spec\\.ts$`))
  const source = readFiles(specFiles, file => join(workspace, file))
  const goldenSource = readFiles(goldenSpecs(item, level), rel => item.golden[rel])
  const testCases = readTestCases(item, level, workspace)
  return {
    item,
    level,
    workspace,
    specFiles,
    source,
    blocks: readTestBlocks(source),
    goldenSource,
    goldenBlocks: readTestBlocks(goldenSource),
    testCases,
    bugCaseIds: readBugCaseIds(item, testCases),
  }
}
