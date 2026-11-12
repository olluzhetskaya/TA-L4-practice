import { cpSync, existsSync, mkdirSync, mkdtempSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { PIPELINE_DIR } from '../../harness-config.ts'
import { toPosix } from '../../lib/files.ts'
import { artifactPath, storyMdPath, testCasePath } from '../paths.ts'
import type { EvalItem } from './dataset.ts'
import { applySkeleton } from './skeleton.ts'

const EXCLUDED = [
  /^node_modules(\/|$)/,
  /^\.git(\/|$)/,
  /^\.env$/,
  /^\.auth(\/|$)/,
  /^playwright-report(\/|$)/,
  /^test-results(\/|$)/,
  new RegExp(`^${PIPELINE_DIR}/eval(/|$)`),
  /^\.agents\/skills\/[^/]+\/eval(\/|$)/,
  /^scripts\/(verify-goldens|run-eval)\.ts$/,
]

/** True for repo paths that never reach an eval workspace. */
export const isExcluded = (rel: string): boolean => EXCLUDED.some(re => re.test(rel))

export type WorkspaceOptions = {
  /** Overlay the golden spec + support files (used to verify the goldens themselves). */
  withGolden?: boolean
}

const copyInto = (src: string, dest: string) => {
  mkdirSync(dirname(dest), { recursive: true })
  cpSync(src, dest)
}

/** Copy the item's golden spec and support files over a workspace. */
export function overlayGolden(workspace: string, item: EvalItem): void {
  for (const [rel, abs] of Object.entries(item.golden)) copyInto(abs, join(workspace, rel))
}

/**
 * A disposable project root for one eval task: a copy of the repo (no eval data, no secrets),
 * node_modules symlinked, reduced to the item's base state, with the item's inputs in place
 * (test cases, story, and the golden analyse-sut artifact the spec skills build on).
 */
export function buildWorkspace(repoRoot: string, item: EvalItem, opts: WorkspaceOptions = {}): string {
  const root = mkdtempSync(join(tmpdir(), `eval-${item.ticket}-`))
  cpSync(repoRoot, root, {
    recursive: true,
    verbatimSymlinks: true,
    filter: src => {
      const rel = toPosix(src.slice(repoRoot.length + 1))
      return rel === '' || !isExcluded(rel)
    },
  })
  if (existsSync(join(repoRoot, 'node_modules'))) symlinkSync(join(repoRoot, 'node_modules'), join(root, 'node_modules'), 'dir')

  if (item.base === 'skeleton') applySkeleton(root, repoRoot)

  copyInto(item.testCases, join(root, testCasePath(item.ticket)))
  if (existsSync(item.story)) copyInto(item.story, join(root, storyMdPath(item.ticket)))
  copyInto(item.artifact, join(root, artifactPath(item.ticket)))
  if (opts.withGolden) overlayGolden(root, item)
  return root
}
