import { fileURLToPath } from 'node:url'
import { PATHS } from '../harness-config.ts'
import { exportSchemas, type SchemaExport } from '../lib/export-schema.ts'
import { storyJsonSchema, testCaseFileSchema } from './input-validation/input-schemas.ts'
import { explorationSchema } from '../skills/analyse-sut/scripts/schema.ts'

const SCHEMA_EXPORTS: SchemaExport[] = [
  { out: PATHS.testCasesSchema, title: 'Manual test cases (pipeline input)', schema: testCaseFileSchema, io: 'input' },
  { out: PATHS.storySchema, title: 'Story (optional JSON input)', schema: storyJsonSchema },
  { out: PATHS.explorationSchema, title: 'SUT exploration artifact (analyse-sut output)', schema: explorationSchema },
]

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const out of exportSchemas(process.cwd(), SCHEMA_EXPORTS)) console.warn(`wrote ${out}`)
}
