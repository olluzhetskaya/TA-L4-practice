/**
 * Zod schemas exported as JSON Schema so editors and the agent can read the contracts without running code.
 *
 *   npm run schema:update   rewrite the *.schema.json files
 *   npm run schema:check    fail when a committed file is stale (push, CI)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z, type ZodType } from 'zod'
import { PATHS } from '../harness-config.ts'
import { explorationSchema } from './exploration-validation/schema.ts'
import { storyJsonSchema, testCaseFileSchema } from './input-validation/input-schemas.ts'

type SchemaExport = {
  out: string
  title: string
  schema: ZodType
  /** `input` describes the file as authored (use it when the schema transforms); `output` the parsed value. */
  io?: 'input' | 'output'
}

const SCHEMA_EXPORTS: SchemaExport[] = [
  { out: PATHS.testCasesSchema, title: 'Manual test cases (pipeline input)', schema: testCaseFileSchema, io: 'input' },
  { out: PATHS.storySchema, title: 'Story (optional JSON input)', schema: storyJsonSchema },
  { out: PATHS.explorationSchema, title: 'SUT exploration artifact (analyse-sut output)', schema: explorationSchema },
]

const render = ({ title, schema, io = 'output' }: SchemaExport) =>
  `${JSON.stringify({ title, ...z.toJSONSchema(schema, { io }) }, null, 2)}\n`

const readOrEmpty = (file: string) => {
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}

export const staleSchemas = (root: string): string[] =>
  SCHEMA_EXPORTS.filter(entry => readOrEmpty(join(root, entry.out)) !== render(entry)).map(entry => entry.out)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.cwd()
  if (process.argv.includes('--check')) {
    const stale = staleSchemas(root)
    if (stale.length) {
      console.error(`Stale schema files, run "npm run schema:update": ${stale.join(', ')}`)
      process.exit(1)
    }
  } else {
    for (const entry of SCHEMA_EXPORTS) writeFileSync(join(root, entry.out), render(entry))
  }
}
