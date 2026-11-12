import { passFailFromSchema } from '../../../../lib/gates/gateResults.ts'
import { explorationSchema, type Exploration } from '../schema.ts'
import type { GateResult } from './types.ts'

/** Runs first. On success, hands the typed Exploration to every downstream gate. */
export function schemaGate(raw: unknown): { result: GateResult; exploration?: Exploration } {
  const { result, value } = passFailFromSchema(explorationSchema, raw)
  return { result, exploration: value }
}
