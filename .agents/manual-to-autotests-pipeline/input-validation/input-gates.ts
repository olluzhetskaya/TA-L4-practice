import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fail, pass, passFailFromSchema, warn, type GateResult } from '../../lib/gates/gateResults.ts'
import { readOutputJson } from '../../lib/files.ts'
import { STRATEGY_FILE, testCasePath } from '../paths.ts'
import { testCaseFileSchema, type StoryContext, type TestCaseFile } from './input-schemas.ts'
import { VALIDATION } from '../../harness-config.ts'
import { loadStory, type StoryLoad } from './load-story.ts'

const VAGUE_EXPECTED = /^(works?|ok|okay|correct(ly)?|success(ful(ly)?)?|as expected|fine|passes?)\.?$/i

function ticketGate(ticket: string, data: TestCaseFile): GateResult {
  return ticket === data.ticket
    ? pass('ticket-match')
    : fail('ticket-match', `file name says ${ticket} but "ticket" is ${data.ticket}`)
}

function storyGate(load: StoryLoad): GateResult {
  if (load.status === 'missing') return warn('story', 'no story found — continuing from the test cases alone (story is optional)')
  if (load.status === 'invalid') return fail('story', load.detail)
  return pass('story')
}

function acRefsGate(data: TestCaseFile, story: StoryContext | undefined): GateResult {
  if (!story) return pass('ac-refs')
  const known = new Set(story.acIds)
  const bad = data.testCases.flatMap(tc =>
    tc.acRefs.filter(ref => !known.has(ref)).map(ref => `${tc.id} → ${ref}`),
  )
  return bad.length === 0 ? pass('ac-refs') : fail('ac-refs', `acRefs not found in the story: ${bad.join(', ')}`)
}

function concreteExpectedGate(data: TestCaseFile): GateResult {
  const vague = data.testCases.flatMap(tc =>
    tc.steps.flatMap((step, i) =>
      step.expected.trim().length < VALIDATION.minExpectedLength || VAGUE_EXPECTED.test(step.expected.trim())
        ? [`${tc.id} step ${i + 1}`]
        : [],
    ),
  )
  return vague.length === 0
    ? pass('concrete-expected')
    : fail('concrete-expected', `expected result is too vague to assert on: ${vague.join(', ')}`)
}

function levelCoverageGate(data: TestCaseFile): GateResult {
  const levels = new Set(data.testCases.map(tc => tc.level))
  return levels.size > 1
    ? pass('level-coverage')
    : warn('level-coverage', `only ${[...levels].join('')} test cases — TEST-STRATEGY §1 expects complementary API + UI coverage`)
}

function strategyGate(root: string): GateResult {
  return existsSync(join(root, STRATEGY_FILE))
    ? pass('strategy')
    : fail('strategy', `${STRATEGY_FILE} is missing — the pipeline must read the test strategy before analysing the SUT`)
}

export type InputReview = { gates: GateResult[]; testCases?: TestCaseFile }

/** Validate `test-cases/<TICKET>.json` and its optional story before the pipeline starts. */
export function reviewInput(root: string, ticket: string): InputReview {
  const parsed = readOutputJson(join(root, testCasePath(ticket)))
  if (!parsed.ok) return { gates: [fail('schema', parsed.detail)] }

  const { result, value } = passFailFromSchema(testCaseFileSchema, parsed.raw)
  if (!value) return { gates: [result] }

  const load = loadStory(root, value.ticket)
  const story = load.status === 'ok' ? load.story : undefined
  return {
    testCases: value,
    gates: [
      result,
      ticketGate(ticket, value),
      storyGate(load),
      acRefsGate(value, story),
      concreteExpectedGate(value),
      levelCoverageGate(value),
      strategyGate(root),
    ],
  }
}
