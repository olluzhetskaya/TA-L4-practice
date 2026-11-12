import assert from 'node:assert/strict'
import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import type { AgentRunner } from '../../lib/eval/cursor-runner.ts'
import { DIRS } from '../../harness-config.ts'
import { artifactPath, testCasePath } from '../paths.ts'
import { goldenSpecs, loadEvalItems, type EvalItem } from './dataset.ts'
import { goldenAgent } from './golden-agent.ts'
import { buildWorkspace } from './workspace.ts'
import { gradeTask, runSpecTask, tasksFor, type SpecTask } from './spec-task.ts'

const repoRoot = process.cwd()
const items = loadEvalItems(repoRoot)
const item = (ticket: string): EvalItem => {
  const found = items.find(i => i.ticket === ticket)
  assert.ok(found, `${ticket} missing from the dataset`)
  return found
}

function goldenWorkspace() {
  const task = tasksFor([item('TOOL-2')], 'api')[0]
  assert.ok(task)
  return { task, ws: buildWorkspace(repoRoot, task.item, { withGolden: true }) }
}

function editGoldenSpec(task: SpecTask, ws: string, edit: (source: string) => string) {
  const specRel = goldenSpecs(task.item, task.level)[0]
  assert.ok(specRel)
  const file = join(ws, specRel)
  writeFileSync(file, edit(readFileSync(file, 'utf8')))
}

const lazyAgent: AgentRunner = async () => 'did nothing'

describe('eval dataset', () => {
  it('has the reference ticket on a skeleton and two extension tickets on the full project', () => {
    assert.deepEqual(items.map(i => [i.ticket, i.base, i.levels.join('+')]), [
      ['TOOL-1', 'skeleton', 'api+ui'],
      ['TOOL-2', 'full', 'api'],
      ['TOOL-3', 'full', 'ui'],
    ])
  })

  it('derives one spec task per level', () => {
    assert.deepEqual(
      tasksFor(items).map(t => `${t.item.ticket}:${t.level}`),
      [
        'TOOL-1:api', 'TOOL-1:ui',
        'TOOL-2:api',
        'TOOL-3:ui',
      ],
    )
  })

  it('ships a golden spec for every level of every ticket', () => {
    for (const i of items) for (const level of i.levels) assert.ok(goldenSpecs(i, level).length > 0, `${i.ticket} ${level}`)
  })
})

describe('eval workspaces', () => {
  it('skeleton base removes the reference feature but keeps the framework', () => {
    const ws = buildWorkspace(repoRoot, item('TOOL-1'))
    try {
      assert.ok(!existsSync(join(ws, 'src/pages/ContactPage.ts')))
      assert.ok(!existsSync(join(ws, 'tests/api/TOOL-1.contact.api.spec.ts')))
      assert.ok(existsSync(join(ws, artifactPath('TOOL-1'))), 'the golden analysis artifact is the spec skills input')
      assert.ok(existsSync(join(ws, 'src/pages/BasePage.ts')))
      assert.ok(existsSync(join(ws, `${DIRS.testCases}/TOOL-1.json`)))
      assert.ok(!existsSync(join(ws, `${DIRS.evalDataset}`)), 'goldens must not leak into the workspace')
    } finally {
      rmSync(ws, { recursive: true, force: true })
    }
  })

  it('full base keeps the reference implementation as an example to extend', () => {
    const ws = buildWorkspace(repoRoot, item('TOOL-2'))
    try {
      assert.ok(existsSync(join(ws, 'src/data/contact.ts')))
      assert.ok(existsSync(join(ws, `${DIRS.testCases}/TOOL-2.json`)))
      assert.ok(existsSync(join(ws, artifactPath('TOOL-2'))), 'the golden analysis artifact is the spec skills input')
    } finally {
      rmSync(ws, { recursive: true, force: true })
    }
  })
})

describe('grading', () => {
  it('rejects an agent that wrote nothing', async () => {
    for (const task of tasksFor(items)) {
      const outcome = await runSpecTask(task, { repoRoot, agent: lazyAgent })
      assert.equal(outcome.passed, false, `${task.item.ticket} ${task.level} should fail`)
    }
  })

  it('accepts golden outputs for every task', async () => {
    for (const task of tasksFor(items)) {
      const outcome = await runSpecTask(task, { repoRoot, agent: goldenAgent(task) })
      const failures = outcome.checks.filter(g => g.status === 'fail')
      assert.deepEqual(failures, [], `${task.item.ticket} ${task.level}`)
    }
  })

  it('flags a spec that loosens the bug assertion instead of marking the bug', () => {
    const { task, ws } = goldenWorkspace()
    try {
      editGoldenSpec(task, ws, source => source.split('\n').filter(line => !line.includes('test.fail(')).join('\n'))
      assert.ok(gradeTask(task, ws, { repoRoot }).some(g => g.gate === 'bug-marking' && g.status === 'fail'))
    } finally {
      rmSync(ws, { recursive: true, force: true })
    }
  })

  it('flags edits to protected files', () => {
    const { task, ws } = goldenWorkspace()
    try {
      appendFileSync(join(ws, 'playwright.config.ts'), '\n')
      rmSync(join(ws, 'tests/api/TOOL-1.contact.api.spec.ts'))
      const gate = gradeTask(task, ws, { repoRoot }).find(g => g.gate === 'protected-files')
      assert.equal(gate?.status, 'fail')
      assert.match(gate?.detail ?? '', /playwright\.config\.ts was modified/)
      assert.match(gate?.detail ?? '', /TOOL-1\.contact\.api\.spec\.ts was deleted/)
    } finally {
      rmSync(ws, { recursive: true, force: true })
    }
  })

  it('flags edits to the task inputs', () => {
    const { task, ws } = goldenWorkspace()
    try {
      appendFileSync(join(ws, testCasePath(task.item.ticket)), '\n')
      const gate = gradeTask(task, ws, { repoRoot }).find(g => g.gate === 'protected-files')
      assert.match(gate?.detail ?? '', /TOOL-2\.json was modified/)
    } finally {
      rmSync(ws, { recursive: true, force: true })
    }
  })

  it('records judge verdicts without letting them decide pass or fail', async () => {
    const task = tasksFor([item('TOOL-2')], 'api')[0]
    assert.ok(task)
    const judgeAgent: AgentRunner = async () => '[{"id":"TC-1","pass":false,"reason":"weak"},{"id":"TC-2","pass":false,"reason":"weak"},{"id":"TC-3","pass":false,"reason":"weak"}]'
    const outcome = await runSpecTask(task, { repoRoot, agent: goldenAgent(task), judge: { agent: judgeAgent } })
    assert.equal(outcome.passed, true)
    assert.deepEqual(outcome.judgement.filter(c => c.status === 'fail').map(c => c.name), ['judge:TC-1', 'judge:TC-2', 'judge:TC-3'])
  })
})
