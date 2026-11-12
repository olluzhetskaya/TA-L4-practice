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

const callName = (call: ts.CallExpression, sf: ts.SourceFile) => call.expression.getText(sf)

function directArgumentOf(node: ts.Node, expectedCall: string, index: number, sf: ts.SourceFile): boolean {
  return (
    ts.isCallExpression(node.parent) &&
    callName(node.parent, sf) === expectedCall &&
    node.parent.arguments[index]?.pos === node.pos
  )
}

function insideAnnotationPush(node: ts.Node, sf: ts.SourceFile): boolean {
  for (let current = node.parent; current; current = current.parent)
    if (ts.isCallExpression(current) && callName(current, sf).endsWith('.annotations.push')) return true
  return false
}

function allowedTestLiteral(node: ts.Node, sf: ts.SourceFile): boolean {
  if (ts.isStringLiteral(node) && ts.isImportDeclaration(node.parent)) return true
  if ((ts.isPropertyAssignment(node.parent) || ts.isMethodDeclaration(node.parent)) && node.parent.name === node) return true
  if (insideAnnotationPush(node, sf)) return true
  return (
    directArgumentOf(node, 'test', 0, sf) ||
    directArgumentOf(node, 'test.step', 0, sf) ||
    directArgumentOf(node, 'testCase', 0, sf) ||
    directArgumentOf(node, 'expect', 1, sf) ||
    directArgumentOf(node, 'test.fail', 0, sf) ||
    directArgumentOf(node, 'test.fail', 1, sf)
  )
}

export function readSpecTests(source: string): SpecTest[] {
  const sf = parse(source)
  const tests: SpecTest[] = []
  descendants(sf, node => {
    if (ts.isCallExpression(node) && node.expression.getText(sf) === 'test' && literalText(node.arguments[0]) !== undefined)
      tests.push(readTest(node, sf))
  })
  return tests
}

/** Inline payload and expected-value literals; reporting and annotation strings are excluded. */
export function readInlineTestData(source: string): string[] {
  const sf = parse(source)
  const literals: string[] = []
  descendants(sf, node => {
    const literal =
      ts.isStringLiteralLike(node) ||
      ts.isNumericLiteral(node) ||
      node.kind === ts.SyntaxKind.TrueKeyword ||
      node.kind === ts.SyntaxKind.FalseKeyword ||
      node.kind === ts.SyntaxKind.RegularExpressionLiteral
    if (literal && !allowedTestLiteral(node, sf)) literals.push(node.getText(sf))
  })
  return literals
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
