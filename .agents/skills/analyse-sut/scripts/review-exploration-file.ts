import { join } from 'node:path'
import { fail, fixRequired, toCheckResult, type CheckResult } from '../../../lib/gates/gateResults.ts'
import { readOutputJson } from '../../../lib/files.ts'
import { testCasePath, ticketFromFileName } from '../../../manual-to-autotests-pipeline/paths.ts'
import { testCaseFileSchema } from '../../../manual-to-autotests-pipeline/input-validation/input-schemas.ts'
import { passFailFromSchema } from '../../../lib/gates/gateResults.ts'
import { runGates } from './gates/index.ts'

/** Output hook for analyse-sut: validate `.agents/manual-to-autotests-pipeline/artifacts/explore-<TICKET>.json` against schema + the input TCs. */
export function reviewExplorationFile(file: string, opts: { root?: string } = {}): CheckResult {
  const root = opts.root ?? process.cwd()
  const ticket = ticketFromFileName(file)
  if (!ticket)
    return fixRequired(file, ticket, fail('filename', 'file name must be explore-<TICKET>.json, e.g. explore-TOOL-1.json'))

  const artifact = readOutputJson(file)
  if (!artifact.ok) return fixRequired(file, ticket, fail('schema', artifact.detail))

  const tcFile = join(root, testCasePath(ticket))
  const tcRaw = readOutputJson(tcFile)
  if (!tcRaw.ok) return fixRequired(file, ticket, fail('test-cases', `${testCasePath(ticket)}: ${tcRaw.detail}`))
  const { result, value: testCases } = passFailFromSchema(testCaseFileSchema, tcRaw.raw)
  if (!testCases) return fixRequired(file, ticket, { ...result, gate: 'test-cases' })

  return toCheckResult(file, ticket, runGates(testCases, artifact.raw))
}
