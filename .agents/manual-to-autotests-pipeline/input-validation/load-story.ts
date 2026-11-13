import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { storyJsonPath, storyMdPath } from '../paths.ts'
import { storyJsonSchema, type StoryContext } from './input-schemas.ts'
import { formatZod } from '../../lib/gateResults.ts'

export type StoryLoad =
  | { status: 'missing' }
  | { status: 'invalid'; detail: string }
  | { status: 'ok'; story: StoryContext }

const AC_IN_TEXT = /\bAC-\d+\b/g

/** Load the optional story for a ticket. JSON wins over Markdown when both exist. */
export function loadStory(root: string, ticket: string): StoryLoad {
  const jsonFile = join(root, storyJsonPath(ticket))
  const mdFile = join(root, storyMdPath(ticket))

  if (existsSync(jsonFile)) {
    let raw: unknown
    try {
      raw = JSON.parse(readFileSync(jsonFile, 'utf8'))
    } catch (err) {
      return { status: 'invalid', detail: `${storyJsonPath(ticket)} is not valid JSON (${(err as Error).message})` }
    }
    const parsed = storyJsonSchema.safeParse(raw)
    if (!parsed.success) return { status: 'invalid', detail: `${storyJsonPath(ticket)}: ${formatZod(parsed.error)}` }
    const { statement, acceptanceCriteria } = parsed.data
    return {
      status: 'ok',
      story: {
        format: 'json',
        text: [statement, ...acceptanceCriteria.map(ac => `${ac.id} ${ac.text}`)].join('\n'),
        acIds: acceptanceCriteria.map(ac => ac.id),
      },
    }
  }

  if (existsSync(mdFile)) {
    const text = readFileSync(mdFile, 'utf8')
    const acIds = [...new Set(text.match(AC_IN_TEXT) ?? [])]
    if (acIds.length === 0)
      return { status: 'invalid', detail: `${storyMdPath(ticket)} has no acceptance criteria ids (AC-1, AC-2, ...)` }
    return { status: 'ok', story: { format: 'md', text, acIds } }
  }

  return { status: 'missing' }
}
