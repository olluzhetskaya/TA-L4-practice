/**
 * Advanced, optional: grade spec generation on fixed tickets.
 *
 *   npm run eval -- --golden [TICKET]   grade the stored golden answers: calibrates the graders, needs no API key
 *   npm run eval [TICKET]               run a live agent (CURSOR_API_KEY) on each task and grade what it wrote
 *
 * Flags: --level=api|ui  --no-run (skip Playwright)  --keep (keep each workspace)  --verbose (print every gate)
 *        --judge  also grade with the LLM judge (advisory, costs tokens; CURSOR_JUDGE_MODEL picks its model).
 *                 With --golden it calibrates the judge: the goldens must get full marks.
 */
import { parseArgs } from 'node:util'
import { hasFailure } from '../.agents/lib/gates/gateResults.ts'
import { createCursorRunner } from '../.agents/manual-to-autotests-pipeline/eval/cursor-runner.ts'
import { loadEvalItems } from '../.agents/manual-to-autotests-pipeline/eval/dataset.ts'
import { goldenAgent } from '../.agents/manual-to-autotests-pipeline/eval/golden-agent.ts'
import { runSpecTask, tasksFor, type TaskOutcome } from '../.agents/manual-to-autotests-pipeline/eval/spec-task.ts'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    golden: { type: 'boolean', default: false },
    level: { type: 'string' },
    'no-run': { type: 'boolean', default: false },
    keep: { type: 'boolean', default: false },
    judge: { type: 'boolean', default: false },
    verbose: { type: 'boolean', default: false },
  },
})

if ((!values.golden || values.judge) && !process.env.CURSOR_API_KEY) {
  process.stderr.write('CURSOR_API_KEY is not set: a live run and the judge call a real agent and need it (see .env.example)\n')
  process.exit(2)
}

const repoRoot = process.cwd()
const [ticket] = positionals
const tasks = tasksFor(loadEvalItems(repoRoot)).filter(
  task => (!ticket || task.item.ticket === ticket) && (!values.level || task.level === values.level),
)
if (tasks.length === 0) {
  process.stderr.write(`no eval tasks match ticket=${ticket ?? '*'} level=${values.level ?? '*'}\n`)
  process.exit(2)
}
const cursor = values.golden && !values.judge ? undefined : createCursorRunner()
const judge = values.judge && cursor ? { agent: cursor, model: process.env.CURSOR_JUDGE_MODEL } : undefined
const statusMark = { pass: '✓', warn: '!', fail: '✗' } as const

const outcomes: TaskOutcome[] = []
for (const task of tasks) {
  const agent = values.golden || !cursor ? goldenAgent(task) : cursor
  const outcome = await runSpecTask(task, { repoRoot, agent, runSpecs: !values['no-run'], keepWorkspace: values.keep, judge }).catch(
    (error: unknown): TaskOutcome => ({
      task,
      workspace: '',
      gates: [{ gate: 'agent', status: 'fail', detail: error instanceof Error ? error.message : String(error) }],
      judgement: [],
      passed: false,
    }),
  )
  outcomes.push(outcome)
  const results = [...outcome.gates, ...outcome.judgement]
  const shown = values.verbose ? results : results.filter(gate => gate.status === 'fail')
  const details = shown.map(gate => {
    const advisory = outcome.judgement.includes(gate) ? ' (advisory)' : ''
    const detail = gate.detail ? `: ${gate.detail}` : ''
    return `\n       ${statusMark[gate.status]} ${gate.gate}${advisory}${detail}`
  })
  const kept = values.keep && outcome.workspace ? `\n       workspace: ${outcome.workspace}` : ''
  process.stdout.write(`${hasFailure(outcome.gates) ? 'FAIL' : 'ok  '} ${task.item.ticket} ${task.level}${details.join('')}${kept}\n`)
}

const passed = outcomes.filter(outcome => outcome.passed).length
const judged = outcomes.flatMap(outcome => outcome.judgement)
process.stdout.write(`\ntasks passed: ${passed}/${outcomes.length}\n`)
if (judged.length) process.stdout.write(`judge criteria passed (advisory): ${judged.filter(g => g.status === 'pass').length}/${judged.length}\n`)
const judgeCalibrated = !(values.golden && values.judge) || judged.every(g => g.status === 'pass')
process.exit(passed === outcomes.length && judgeCalibrated ? 0 : 1)
