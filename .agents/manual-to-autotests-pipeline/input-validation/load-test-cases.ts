import { join } from 'node:path'
import { readOutputJson } from '../../lib/files.ts'
import { fail, passFailFromSchema, type GateResult } from '../../lib/gates/gateResults.ts'
import { testCasePath } from '../paths.ts'
import { testCaseFileSchema, type TestCaseFile } from './input-schemas.ts'

/** The ticket's test cases, or the gate that explains why they cannot be read (the stage reviews that need them stop there). */
export function loadTestCases(root: string, ticket: string): { ok: true; testCases: TestCaseFile } | { ok: false; gate: GateResult } {
  const raw = readOutputJson(join(root, testCasePath(ticket)))
  if (!raw.ok) return { ok: false, gate: fail('test-cases', `${testCasePath(ticket)}: ${raw.detail}`) }
  const { result, value } = passFailFromSchema(testCaseFileSchema, raw.raw)
  return value ? { ok: true, testCases: value } : { ok: false, gate: { ...result, gate: 'test-cases' } }
}
