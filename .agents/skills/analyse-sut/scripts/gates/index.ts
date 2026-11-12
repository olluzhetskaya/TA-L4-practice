import { schemaGate } from './schema-gate.ts'
import { locatorGate } from './locator-gate.ts'
import { referencesGate } from './references-gate.ts'
import { coverageGate } from './coverage-gate.ts'
import { apiGate } from './api-gate.ts'
import type { GateResult } from '../../../../lib/gates/gateResults.ts'
import type { TestCaseFile } from '../../../../manual-to-autotests-pipeline/input-validation/input-schemas.ts'

/**
 * Schema gate first — if it fails, the semantic gates get no typed value and are skipped.
 * The rest are pure functions over the typed artifact + the manual test cases.
 */
export function runGates(testCases: TestCaseFile, raw: unknown): GateResult[] {
  const { result, exploration } = schemaGate(raw)
  if (!exploration) return [result]
  const ctx = { testCases, exploration }
  return [result, referencesGate(ctx), coverageGate(ctx), locatorGate(ctx), apiGate(ctx)]
}
