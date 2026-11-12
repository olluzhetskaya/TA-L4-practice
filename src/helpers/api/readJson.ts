import type { APIResponse } from '@playwright/test'
import type { ZodType } from 'zod'

/** Parse a response body with a Zod schema; throws with status + issues so failures explain themselves. */
export async function readJson<T>(response: APIResponse, schema: ZodType<T>): Promise<T> {
  const raw: unknown = await response.json()
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')
    throw new Error(`${response.url()} → ${response.status()}: body does not match schema (${issues})`)
  }
  return parsed.data
}
