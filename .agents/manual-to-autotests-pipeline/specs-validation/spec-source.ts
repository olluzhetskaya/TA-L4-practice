import ts from 'typescript'
import { FILE_PATTERNS } from '../../harness-config.ts'
import { testLevelSchema, type TestLevel } from '../input-validation/input-schemas.ts'

/** What a spec file declares about one `test(...)`, read from the syntax tree. */
export type SpecTest = {
  title: string
  /** From `annotation: testCase('TC-n')`. */
  tcId?: string
  stepTitles: string[]
  /** `HttpStatus.X` members referenced in the test body. */
  statuses: string[]
  /** Playwright/Jest matcher names called on `expect(...)`, preserving duplicates. */
  matchers: string[]
  /** The body calls `test.fail(...)`. */
  expectedFailure: boolean
}

const DISABLED_TEST = /^(?:test|describe|test\.describe)\.(?:skip|fixme|only)$/

const literalText = (node: ts.Node | undefined): string | undefined => {
  if (node && ts.isStringLiteralLike(node)) return node.text
  if (node && ts.isTemplateExpression(node)) return node.head.text
  return undefined
}

function descendants(root: ts.Node, visit: (node: ts.Node) => void) {
  const walk = (node: ts.Node) => {
    visit(node)
    ts.forEachChild(node, walk)
  }
  walk(root)
}

function expectMatcher(node: ts.CallExpression): string | undefined {
  if (!ts.isPropertyAccessExpression(node.expression)) return undefined
  let target: ts.Expression = node.expression.expression
  while (ts.isPropertyAccessExpression(target)) target = target.expression
  return ts.isCallExpression(target) && target.expression.getText() === 'expect' ? node.expression.name.text : undefined
}

function readTest(call: ts.CallExpression, sf: ts.SourceFile): SpecTest {
  const test: SpecTest = {
    title: literalText(call.arguments[0]) ?? '',
    stepTitles: [],
    statuses: [],
    matchers: [],
    expectedFailure: false,
  }
  const options = call.arguments[1]
  if (options && ts.isObjectLiteralExpression(options)) {
    const annotation = options.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(sf) === 'annotation')
    if (annotation)
      descendants(annotation, node => {
        if (ts.isCallExpression(node) && node.expression.getText(sf) === 'testCase') test.tcId ??= literalText(node.arguments[0])
      })
  }
  descendants(call, node => {
    if (ts.isCallExpression(node)) {
      const name = node.expression.getText(sf)
      if (name === 'test.step') test.stepTitles.push(literalText(node.arguments[0]) ?? '')
      if (name === 'test.fail') test.expectedFailure = true
      const matcher = expectMatcher(node)
      if (matcher) test.matchers.push(matcher)
    }
    if (ts.isPropertyAccessExpression(node) && node.expression.getText(sf) === 'HttpStatus' && !test.statuses.includes(node.name.text))
      test.statuses.push(node.name.text)
  })
  return test
}

const parse = (source: string) => ts.createSourceFile('spec.ts', source, ts.ScriptTarget.Latest, true)

export function readSpecTests(source: string): SpecTest[] {
  const sf = parse(source)
  const tests: SpecTest[] = []
  descendants(sf, node => {
    if (ts.isCallExpression(node) && node.expression.getText(sf) === 'test' && literalText(node.arguments[0]) !== undefined)
      tests.push(readTest(node, sf))
  })
  return tests
}

/** `test.skip`, `test.fixme`, `test.only`, `describe.skip` … — anything that stops a test from running in the suite. */
export function readDisabledTestMarkers(source: string): string[] {
  const sf = parse(source)
  const markers = new Set<string>()
  descendants(sf, node => {
    if (ts.isPropertyAccessExpression(node) && DISABLED_TEST.test(node.getText(sf))) markers.add(node.getText(sf))
  })
  return [...markers]
}

/** `TOOL-1.contact.api.spec.ts` → 'api'. */
export function levelFromSpecName(file: string): TestLevel | undefined {
  return testLevelSchema.safeParse(FILE_PATTERNS.specLevel.exec(file)?.[1]).data
}
