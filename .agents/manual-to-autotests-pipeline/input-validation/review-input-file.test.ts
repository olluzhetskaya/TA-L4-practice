import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { DIRS } from '../../harness-config.ts'
import { reviewInputFile } from './review-input-files.ts'

let root = ''
const tcFile = () => join(root, `${DIRS.testCases}/TOOL-1.json`)
const readTc = () => JSON.parse(readFileSync(tcFile(), 'utf8'))
const writeTc = (data: unknown) => writeFileSync(tcFile(), JSON.stringify(data))
const gate = (name: string) => reviewInputFile(tcFile(), { root }).gates.find(g => g.gate === name)

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'input-hook-'))
  mkdirSync(join(root, DIRS.testCases), { recursive: true })
  mkdirSync(join(root, DIRS.stories), { recursive: true })
  mkdirSync(join(root, 'wiki'), { recursive: true })
  cpSync(`${DIRS.testCases}/TOOL-1.json`, tcFile())
  cpSync(`${DIRS.stories}/TOOL-1.md`, join(root, `${DIRS.stories}/TOOL-1.md`))
  cpSync('wiki/TEST-STRATEGY.md', join(root, 'wiki/TEST-STRATEGY.md'))
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('input hook', () => {
  it('accepts the TOOL-1 inputs', () => {
    assert.equal(reviewInputFile(tcFile(), { root }).decision, 'continue')
  })

  it('fails on invalid JSON', () => {
    writeFileSync(tcFile(), '{ nope')
    assert.equal(gate('schema')?.status, 'fail')
  })

  it('fails when a test case has no level', () => {
    const data = readTc()
    delete data.testCases[0].level
    writeTc(data)
    assert.match(gate('schema')?.detail ?? '', /level/)
  })

  it('fails on duplicate test case ids', () => {
    const data = readTc()
    data.testCases[1].id = 'TC-1'
    writeTc(data)
    assert.match(gate('schema')?.detail ?? '', /duplicate id/)
  })

  it('fails when the file name and ticket disagree', () => {
    const data = readTc()
    data.ticket = 'TOOL-9'
    writeTc(data)
    assert.equal(gate('ticket-match')?.status, 'fail')
  })

  it('fails on vague expected results', () => {
    const data = readTc()
    data.testCases[0].steps[0].expected = 'works'
    writeTc(data)
    assert.equal(gate('concrete-expected')?.status, 'fail')
  })

  it('fails when acRefs are not in the story', () => {
    const data = readTc()
    data.testCases[0].acRefs = ['AC-99']
    writeTc(data)
    assert.match(gate('ac-refs')?.detail ?? '', /AC-99/)
  })

  it('treats the story as optional (warn)', () => {
    rmSync(join(root, `${DIRS.stories}/TOOL-1.md`))
    const result = reviewInputFile(tcFile(), { root })
    assert.equal(result.decision, 'continue')
    assert.equal(gate('story')?.status, 'warn')
  })

  it('accepts a JSON story', () => {
    rmSync(join(root, `${DIRS.stories}/TOOL-1.md`))
    writeFileSync(
      join(root, `${DIRS.stories}/TOOL-1.json`),
      JSON.stringify({
        ticket: 'TOOL-1',
        title: 'Contact',
        statement: 'As a shopper I want to contact support',
        acceptanceCriteria: ['AC-1', 'AC-2', 'AC-3', 'AC-4', 'AC-5', 'AC-6', 'AC-7'].map(id => ({ id, text: 'x' })),
      }),
    )
    assert.equal(gate('story')?.status, 'pass')
    assert.equal(gate('ac-refs')?.status, 'pass')
  })

  it('fails when the test strategy is missing', () => {
    rmSync(join(root, 'wiki/TEST-STRATEGY.md'))
    assert.equal(gate('strategy')?.status, 'fail')
  })

  it('warns when only one test level is present', () => {
    const data = readTc()
    data.testCases = data.testCases.filter((tc: { level: string }) => tc.level === 'api')
    writeTc(data)
    assert.equal(gate('level-coverage')?.status, 'warn')
  })
})
