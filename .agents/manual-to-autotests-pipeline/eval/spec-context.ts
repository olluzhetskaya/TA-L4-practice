import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { listFiles, readOutputJson } from '../../lib/files.ts'
import { explorationSchema } from '../exploration-validation/schema.ts'
import { testCaseFileSchema, type ManualTestCase, type TestLevel } from '../input-validation/input-schemas.ts'
import { testCasePath } from '../paths.ts'
import { readSpecTests, type SpecTest } from '../specs-validation/spec-source.ts'
import { goldenSpecs, type EvalItem } from './dataset.ts'

/** Everything a check needs to know about one written spec set, read once. */
export type SpecContext = {
  item: EvalItem
  level: TestLevel
  workspace: string
  specs: { file: string; source: string; tests: SpecTest[] }[]
  /** Every test of every spec file. */
  tests: SpecTest[]
  goldenSource: string
  goldenTests: SpecTest[]
  /** Manual test cases of this level. */
  testCases: ManualTestCase[]
  /** Test cases the golden analysis recorded as hitting a product bug. */
  bugCaseIds: Set<string>
}

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
  const specs = listFiles(workspace, `tests/${level}`, new RegExp(`/${item.ticket}\\.[^/]+\\.${level}\\.spec\\.ts$`)).map(file => {
    const source = readFileSync(join(workspace, file), 'utf8')
    return { file, source, tests: readSpecTests(source) }
  })
  const goldenSource = goldenSpecs(item, level).map(rel => readFileSync(item.golden[rel] ?? '', 'utf8')).join('\n')
  const testCases = readTestCases(item, level, workspace)
  return {
    item,
    level,
    workspace,
    specs,
    tests: specs.flatMap(spec => spec.tests),
    goldenSource,
    goldenTests: readSpecTests(goldenSource),
    testCases,
    bugCaseIds: readBugCaseIds(item, testCases),
  }
}
