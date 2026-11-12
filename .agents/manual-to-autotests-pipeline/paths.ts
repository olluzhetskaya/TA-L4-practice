import { DIRS, FILE_PATTERNS, PATHS } from '../harness-config.ts'

export { DIRS }
export const STRATEGY_FILE = PATHS.strategyFile

export const storyMdPath = (ticket: string) => `${DIRS.stories}/${ticket}.md`
export const storyJsonPath = (ticket: string) => `${DIRS.stories}/${ticket}.json`
export const testCasePath = (ticket: string) => `${DIRS.testCases}/${ticket}.json`
export const artifactPath = (ticket: string) => `${DIRS.artifacts}/explore-${ticket}.json`

/** Ticket id from a file name: `TOOL-1.json`, `explore-TOOL-1.json`, `TOOL-1.contact.api.spec.ts`. */
export function ticketFromFileName(file: string): string | undefined {
  const base = file.split(/[\\/]/).pop() ?? file
  return FILE_PATTERNS.ticketAtStart.exec(base)?.[1]
}

export const DATASET_FILES = {
  testCases: 'test-cases.json',
  story: 'story.md',
  reference: 'reference',
} as const
