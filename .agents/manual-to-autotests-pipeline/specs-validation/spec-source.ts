import type { TestLevel } from '../input-validation/input-schemas.ts'
import { FILE_PATTERNS } from '../../harness-config.ts'

const QUOTED = String.raw`(['"\`])((?:\\.|(?!\1).)*)\1`
const TEST_TITLE = new RegExp(String.raw`\btest\(\s*${QUOTED}`, 'g')
const STEP_TITLE = new RegExp(String.raw`\btest\.step\(\s*${QUOTED}`, 'g')
const TC_ANNOTATION = /\btestCase\(\s*['"`](TC-\d+)['"`]\s*\)/g

export type SpecFacts = {
  titles: string[]
  stepTitles: string[]
  tcIds: string[]
}

const collect = (re: RegExp, text: string, group: number): string[] =>
  [...text.matchAll(re)].map(m => m[group] ?? '')

/** Light static read of a spec — enough for traceability gates without a TS parser. */
export function readSpecFacts(source: string): SpecFacts {
  return {
    titles: collect(TEST_TITLE, source, 2),
    stepTitles: collect(STEP_TITLE, source, 2),
    tcIds: collect(TC_ANNOTATION, source, 1),
  }
}

/** Source text of each annotated test: from its `testCase('TC-n')` annotation up to the next annotation. */
export function readTestBlocks(source: string): Map<string, string> {
  const marks = [...source.matchAll(TC_ANNOTATION)]
  return new Map(
    marks.map((mark, i) => [mark[1] ?? '', source.slice(mark.index ?? 0, marks[i + 1]?.index ?? source.length)]),
  )
}

export type BlockFacts = {
  statuses: string[]
  assertions: number
  expectedFailure: boolean
}

const HTTP_STATUS = /\bHttpStatus\.(\w+)/g
const ASSERTION = /\bexpect\(/g
const EXPECTED_FAILURE = /\btest\.fail\(/
const DISABLED_TEST = /\b(?:test|describe)(?:\.describe)?\.(?:skip|fixme|only)\b/g

/** `test.skip`, `test.fixme`, `test.only`, `describe.skip` … — anything that stops a test from running in the suite. */
export const readDisabledTestMarkers = (source: string): string[] => [...new Set(collect(DISABLED_TEST, source, 0))]

/** What one test asserts that does not depend on how the author named their own helpers. */
export function readBlockFacts(block: string): BlockFacts {
  return {
    statuses: [...new Set(collect(HTTP_STATUS, block, 1))],
    assertions: collect(ASSERTION, block, 0).length,
    expectedFailure: EXPECTED_FAILURE.test(block),
  }
}

/** `TOOL-1.contact.api.spec.ts` → 'api'. */
export function levelFromSpecName(file: string): TestLevel | undefined {
  const match = FILE_PATTERNS.specLevel.exec(file)
  return match ? (match[1] as TestLevel) : undefined
}
