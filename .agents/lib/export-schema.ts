import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { z, type ZodType } from 'zod'

export type SchemaExport = {
  out: string
  title: string
  schema: ZodType
  /** `input` describes the file as authored (use it when the schema transforms); `output` the parsed value. */
  io?: 'input' | 'output'
}

export function renderSchema({ title, schema, io = 'output' }: SchemaExport): string {
  const json = z.toJSONSchema(schema, { io })
  return JSON.stringify({ title, ...json }, null, 2) + '\n'
}

export function exportSchemas(root: string, schemas: SchemaExport[]): string[] {
  return schemas.map(entry => {
    const abs = join(root, entry.out)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, renderSchema(entry))
    return entry.out
  })
}
