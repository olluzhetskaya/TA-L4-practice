import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

export const toPosix = (p: string) => p.split(sep).join('/')
export const relPosix = (root: string, file: string) => toPosix(relative(root, file))

/** Recursively list files under `dir` (relative to `root`) whose root-relative path matches `pattern`. */
export function listFiles(root: string, dir: string, pattern: RegExp): string[] {
  const abs = join(root, dir)
  if (!existsSync(abs)) return []
  return readdirSync(abs, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => `${dir}/${relPosix(abs, join(entry.parentPath, entry.name))}`)
    .filter(rel => pattern.test(rel))
    .sort((a, b) => a.localeCompare(b))
}

/** Parse a JSON file safely. Returns a structured error the agent can act on rather than throwing. */
export function readOutputJson(file: string): { ok: true; raw: unknown } | { ok: false; detail: string } {
  try {
    return { ok: true, raw: JSON.parse(readFileSync(file, 'utf8')) }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    return { ok: false, detail: `the file is not valid JSON (${reason}). It must contain one JSON object and nothing else.` }
  }
}
