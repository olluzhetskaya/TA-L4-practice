import { fail, fixRequired, toCheckResult, type CheckResult } from '../../../lib/gates/gateResults.ts'
import { readOutputJson } from '../../../lib/files.ts'
import { ticketFromFileName } from '../../../manual-to-autotests-pipeline/paths.ts'
import { loadTestCases } from '../../../manual-to-autotests-pipeline/input-validation/load-test-cases.ts'
import { runGates } from './gates/index.ts'

/** Output hook for analyse-sut: validate `.agents/manual-to-autotests-pipeline/artifacts/explore-<TICKET>.json` against schema + the input TCs. */
export function reviewExplorationFile(file: string, opts: { root?: string } = {}): CheckResult {
  const root = opts.root ?? process.cwd()
  const ticket = ticketFromFileName(file)
  if (!ticket)
    return fixRequired(file, ticket, fail('filename', 'file name must be explore-<TICKET>.json, e.g. explore-TOOL-1.json'))

  const artifact = readOutputJson(file)
  if (!artifact.ok) return fixRequired(file, ticket, fail('schema', artifact.detail))

  const loaded = loadTestCases(root, ticket)
  if (!loaded.ok) return fixRequired(file, ticket, loaded.gate)

  return toCheckResult(file, ticket, runGates(loaded.testCases, artifact.raw))
}
