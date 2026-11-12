import type { Exploration } from '../schema.ts'
import type { TestCaseFile } from '../../../../manual-to-autotests-pipeline/input-validation/input-schemas.ts'

import type { GateResult } from '../../../../lib/gates/gateResults.ts'

export { pass, fail, warn, type GateResult, type GateStatus } from '../../../../lib/gates/gateResults.ts'

/** Context handed to every semantic gate. */
export type GateContext = {
  testCases: TestCaseFile
  exploration: Exploration
}

/** A semantic gate is a pure function: no file I/O, no side effects. */
export type Gate = (ctx: GateContext) => GateResult
