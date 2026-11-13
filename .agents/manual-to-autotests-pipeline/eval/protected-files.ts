import { existsSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { EVAL_PROTECTED, FILE_PATTERNS } from '../../harness-config.ts'
import { listFiles } from '../../lib/files.ts'
import { gateFromProblems, type GateResult } from '../../lib/gateResults.ts'
import { artifactPath, testCasePath } from '../paths.ts'
import type { EvalItem } from './dataset.ts'
import { isExcluded } from './workspace.ts'

const MAX_REPORTED = 5

/** A workspace file that must equal `original`. */
type ProtectedFile = { rel: string; original: string }

function protectedFiles(item: EvalItem, repoRoot: string): ProtectedFile[] {
  const fromRepo = (rel: string): ProtectedFile => ({ rel, original: join(repoRoot, rel) })
  const config = EVAL_PROTECTED.files.filter(rel => existsSync(join(repoRoot, rel))).map(fromRepo)
  const tooling = EVAL_PROTECTED.dirs.flatMap(dir => listFiles(repoRoot, dir, /./)).filter(rel => !isExcluded(rel)).map(fromRepo)
  const otherSpecs = listFiles(repoRoot, 'tests', FILE_PATTERNS.specFile)
    .filter(rel => !basename(rel).startsWith(`${item.ticket}.`))
    .map(fromRepo)
  const inputs: ProtectedFile[] = [
    { rel: testCasePath(item.ticket), original: item.testCases },
    { rel: artifactPath(item.ticket), original: item.artifact },
  ]
  return [...config, ...tooling, ...otherSpecs, ...inputs]
}

const sameContent = (a: string, b: string) => readFileSync(a).equals(readFileSync(b))

function problemWith(workspace: string, { rel, original }: ProtectedFile): string[] {
  const written = join(workspace, rel)
  if (!existsSync(written)) return [`${rel} was deleted`]
  return sameContent(written, original) ? [] : [`${rel} was modified`]
}

/** Configs, tooling, other tickets' specs and this task's inputs must come back unchanged — editing them would loosen the gates. */
export function protectedFilesGate(item: EvalItem, workspace: string, repoRoot: string): GateResult {
  const problems = protectedFiles(item, repoRoot).flatMap(file => problemWith(workspace, file))
  const shown = problems.slice(0, MAX_REPORTED)
  const hidden = problems.length - shown.length
  return gateFromProblems('protected-files', hidden > 0 ? [...shown, `…and ${hidden} more`] : shown)
}
