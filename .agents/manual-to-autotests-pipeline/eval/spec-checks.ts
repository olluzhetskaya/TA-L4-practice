import ts from 'typescript'
import { gateFromProblems, type GateResult } from '../../lib/gates/gateResults.ts'
import { readDisabledTestMarkers } from '../specs-validation/spec-source.ts'
import type { SpecContext } from './spec-context.ts'

/** A pure, deterministic rule over the written specs. */
export type SpecCheck = (ctx: SpecContext) => GateResult

/** No test is switched off: a skipped test cannot fail, so it cannot be graded. */
export const noDisabledTestsCheck: SpecCheck = ({ specs }) =>
  gateFromProblems(
    'no-disabled-tests',
    [...new Set(specs.flatMap(spec => readDisabledTestMarkers(spec.source)))].map(marker => `${marker} disables a test`),
  )

/** `test.fail` marks exactly the cases that hit a known product bug — never a failure that should be fixed. */
export const bugMarkingCheck: SpecCheck = ({ tests, bugCaseIds }) =>
  gateFromProblems(
    'bug-marking',
    tests.flatMap(({ tcId, expectedFailure }) => {
      if (!tcId) return []
      if (bugCaseIds.has(tcId) && !expectedFailure) return [`${tcId} hits a product bug, so the test must call test.fail(true, 'BUG: …')`]
      if (!bugCaseIds.has(tcId) && expectedFailure) return [`${tcId} has no known product bug but calls test.fail`]
      return []
    }),
  )

/** Every HTTP status the golden asserts for a case must also be asserted by the written test; helper and constant names are free. */
export const statusParityCheck: SpecCheck = ({ tests, goldenTests }) =>
  gateFromProblems(
    'parity:statuses',
    goldenTests.flatMap(golden => {
      const written = golden.tcId ? tests.find(test => test.tcId === golden.tcId) : undefined
      const lacking = written ? golden.statuses.filter(status => !written.statuses.includes(status)) : []
      return lacking.length ? [`${golden.tcId} never asserts HttpStatus.${lacking.join(', HttpStatus.')}`] : []
    }),
  )

/** The generated test keeps at least the assertion matcher strength demonstrated by the controlled golden output. */
export const assertionParityCheck: SpecCheck = ({ tests, goldenTests }) =>
  gateFromProblems(
    'parity:assertions',
    goldenTests.flatMap(golden => {
      const written = golden.tcId ? tests.find(test => test.tcId === golden.tcId) : undefined
      if (!written) return []
      const available = [...written.matchers]
      const missing = golden.matchers.filter(matcher => {
        const index = available.indexOf(matcher)
        if (index < 0) return true
        available.splice(index, 1)
        return false
      })
      return missing.length ? [`${golden.tcId} lacks assertion matcher(s): ${missing.join(', ')}`] : []
    }),
  )

const parse = (source: string) => ts.createSourceFile('spec.ts', source, ts.ScriptTarget.Latest, true)

function descendants(root: ts.Node, visit: (node: ts.Node) => void) {
  const walk = (node: ts.Node) => {
    visit(node)
    ts.forEachChild(node, walk)
  }
  walk(root)
}

const callName = (call: ts.CallExpression, sf: ts.SourceFile) => call.expression.getText(sf)

function directArgumentOf(node: ts.Node, callNameExpected: string, index: number, sf: ts.SourceFile): boolean {
  return (
    ts.isCallExpression(node.parent) &&
    callName(node.parent, sf) === callNameExpected &&
    node.parent.arguments[index]?.pos === node.pos
  )
}

function insideAnnotationPush(node: ts.Node, sf: ts.SourceFile): boolean {
  for (let current = node.parent; current; current = current.parent)
    if (ts.isCallExpression(current) && callName(current, sf).endsWith('.annotations.push')) return true
  return false
}

function allowedLiteral(node: ts.Node, sf: ts.SourceFile): boolean {
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

/** Payloads and expected values come from fixture-exported data, responses, or Zod schemas—not inline literals. */
export const noHardcodedTestDataCheck: SpecCheck = ({ specs }) => {
  const problems: string[] = []
  for (const spec of specs) {
    const sf = parse(spec.source)
    descendants(sf, node => {
      const literal =
        ts.isStringLiteralLike(node) ||
        ts.isNumericLiteral(node) ||
        node.kind === ts.SyntaxKind.TrueKeyword ||
        node.kind === ts.SyntaxKind.FalseKeyword ||
        node.kind === ts.SyntaxKind.RegularExpressionLiteral
      if (literal && !allowedLiteral(node, sf)) problems.push(`${spec.file}: inline test data ${node.getText(sf)}`)
    })
  }
  return gateFromProblems('no-hardcoded-test-data', problems)
}

export const SPEC_CHECKS: readonly SpecCheck[] = [
  noDisabledTestsCheck,
  bugMarkingCheck,
  noHardcodedTestDataCheck,
  statusParityCheck,
  assertionParityCheck,
]
