import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { spawnSync } from 'node:child_process'

const BAD_SPEC = `
import { value } from '@data/contact'
test('x', async ({ page }) => {
  await page.goto('/contact')
  await page.getByRole('button').click()
  await page.locator('#send').click()
  expect(await page.title()).toBe('x')
  expect(response.ok()).toBe(true)
  expect(response.status()).toBe(200)
  await new Promise(r => setTimeout(r, 1000))
  await test.step('empty', async () => {})
})
test('flat', async ({ page }) => {
  await page.title()
})
`
const BAD_PAGE = `
export class P { run() { test.step('a', async () => { await 1 }); return loc.nth(0) } }
`
const BAD_HELPER = `const url = 'https://api.example.org/x'\nconst t = { timeout: 5000 }\nfoo().then(() => 1)\n`

function scan(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'ast-grep-'))
  try {
    cpSync('sgconfig.yml', join(root, 'sgconfig.yml'))
    cpSync('tools/ast-grep/rules', join(root, 'tools/ast-grep/rules'), { recursive: true })
    for (const [path, body] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(join(root, path), body)
    }
    const run = spawnSync('ast-grep', ['scan', '--report-style=short'], { cwd: root, encoding: 'utf8' })
    return `${run.stdout}${run.stderr}`
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

describe('ast-grep rules', () => {
  it('flag the anti-patterns they exist for', () => {
    const output = scan({
      'tests/ui/bad.spec.ts': BAD_SPEC,
      'src/pages/BadPage.ts': BAD_PAGE,
      'src/helpers/api/Bad.ts': BAD_HELPER,
    })
    const expected = [
      'no-goto-in-spec',
      'no-page-locator-in-spec',
      'no-css-selector-in-spec',
      'expect-needs-message',
      'prefer-api-response-toBeOK',
      'no-status-literal-in-assert',
      'no-manual-sleep',
      'no-empty-test-step',
      'no-fixture-in-page-object',
      'no-nth-zero',
      'no-hardcoded-url-in-api',
      'no-inline-magic-timeout',
      'no-then-in-async-code',
    ]
    const missing = expected.filter(id => !output.includes(id))
    assert.deepEqual(missing, [], output)
  })

  it('stay quiet on a clean spec', () => {
    const clean = `
import { expect, test } from '@fixtures'
test('x', async ({ contactPage }) => {
  await test.step('Verify that a thing', async () => {
    await expect(contactPage.getSendButton(), 'Send should be visible').toBeVisible()
  })
})
`
    assert.equal(scan({ 'tests/ui/ok.spec.ts': clean }).trim(), '')
  })
})
