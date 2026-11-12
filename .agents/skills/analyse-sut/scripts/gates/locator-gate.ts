import { fail, pass, type Gate } from './types.ts'

const SEMANTIC_LOCATOR = /^(?:page\.)?getBy(?:Role|Label|Text|Placeholder|AltText|Title|TestId)\(/
const PLACEHOLDER = /\b(?:TODO|TBD|FIXME|xxx|placeholder text)\b|<[^<>]{1,40}>|\.{3}/i

/**
 * Every locator must be a semantic Playwright expression that was probed live.
 * CSS / XPath, placeholders, and "uiLabel copied from the test case" all fail.
 */
export const locatorGate: Gate = ({ exploration }) => {
  const problems: string[] = []
  for (const loc of exploration.locators) {
    if (!SEMANTIC_LOCATOR.test(loc.locator))
      problems.push(`${loc.id}: "${loc.locator}" is not a getBy* locator (no CSS / XPath)`)
    if (PLACEHOLDER.test(loc.locator) || PLACEHOLDER.test(loc.uiLabel))
      problems.push(`${loc.id}: placeholder text in locator or uiLabel`)
    if (loc.uiLabel.trim().toLowerCase() === loc.tcAction.trim().toLowerCase())
      problems.push(`${loc.id}: uiLabel equals tcAction — record the text actually rendered, not the TC wording`)
  }
  const ids = exploration.locators.map(l => l.id)
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
  if (dupes.length) problems.push(`duplicate locator ids: ${[...new Set(dupes)].join(', ')}`)
  return problems.length ? fail('locators', problems.slice(0, 4).join('; ')) : pass('locators')
}
