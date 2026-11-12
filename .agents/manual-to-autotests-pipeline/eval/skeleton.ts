import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DIRS } from '../../harness-config.ts'
import { listFiles } from '../../lib/files.ts'

/** The ticket whose feature code is the repo's reference implementation. */
export const REFERENCE_TICKET = 'TOOL-1'

/** Feature files that exist only because of the reference ticket. */
export const FEATURE_FILES = ['src/data/contact.ts', 'src/helpers/api/ContactApi.ts', 'src/pages/ContactPage.ts'] as const

/** Shared files that mention the reference feature — replaced by neutral versions from the skeleton overlay. */
export const NEUTRALISED_FILES = [
  'src/data/enums.ts',
  'src/helpers/api/ToolshopApi.ts',
  'tests/fixtures/index.ts',
  'tests/fixtures/toolshop.fixture.ts',
] as const

const REFERENCE_OUTPUT = new RegExp(
  `^(tests/(api|ui)/${REFERENCE_TICKET}\\.[^/]+\\.spec\\.ts|${DIRS.artifacts}/explore-${REFERENCE_TICKET}\\.json)$`,
)

export const skeletonOverlayDir = (repoRoot: string) => join(repoRoot, DIRS.evalSkeleton)

/**
 * Turn a project copy at `root` into the neutral skeleton: the framework core
 * (config, clients, fixtures, gates, hooks, skills) without any feature built on top of it.
 * Used by the eval workspaces.
 */
export function applySkeleton(root: string, repoRoot: string): void {
  for (const rel of FEATURE_FILES) rmSync(join(root, rel), { force: true })
  for (const dir of ['tests', DIRS.artifacts])
    for (const rel of listFiles(root, dir, /./)) if (REFERENCE_OUTPUT.test(rel)) rmSync(join(root, rel), { force: true })
  for (const rel of NEUTRALISED_FILES) {
    const dest = join(root, rel)
    mkdirSync(dirname(dest), { recursive: true })
    cpSync(join(skeletonOverlayDir(repoRoot), rel), dest)
  }
}
