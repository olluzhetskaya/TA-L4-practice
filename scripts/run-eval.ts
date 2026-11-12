import { parseArgs } from 'node:util'
import { TIMEOUTS } from '../.agents/harness-config.ts'
import { createCursorRunner } from '../.agents/lib/eval/cursor-runner.ts'
import { formatSuite, formatTask } from '../.agents/lib/eval/report.ts'
import type { TaskOutcome } from '../.agents/lib/eval/run-task.ts'
import { scoreSuite } from '../.agents/lib/eval/score.ts'
import { loadEvalItems } from '../.agents/manual-to-autotests-pipeline/eval/dataset.ts'
import { runSpecTask, tasksFor, type SpecTask } from '../.agents/manual-to-autotests-pipeline/eval/spec-task.ts'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    level: { type: 'string' },
    'no-run': { type: 'boolean', default: false },
    keep: { type: 'boolean', default: false },
    judge: { type: 'boolean', default: false },
    threshold: { type: 'string', default: '1' },
  },
})

const threshold = Number(values.threshold)
if (!process.env.CURSOR_API_KEY) {
  process.stderr.write('CURSOR_API_KEY is not set: a live eval runs a real agent and needs it (see .env.example)\n')
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
const agent = createCursorRunner()

const outcomes: TaskOutcome<SpecTask>[] = []
for (const task of tasks) {
  const outcome = await runSpecTask(task, {
    repoRoot,
    agent,
    timeoutMs: TIMEOUTS.evalTask,
    runSpecs: !values['no-run'],
    keepWorkspace: values.keep,
    judge: values.judge ? { agent, model: process.env.CURSOR_JUDGE_MODEL } : undefined,
  }).catch((error: unknown): TaskOutcome<SpecTask> => ({
    task,
    workspace: '',
    agentOutput: '',
    checks: [{ name: 'agent', status: 'fail', detail: error instanceof Error ? error.message : String(error) }],
    judgement: [],
    passed: false,
  }))
  outcomes.push(outcome)
  const kept = values.keep && outcome.workspace ? `\n       workspace: ${outcome.workspace}` : ''
  const label = `${task.item.ticket} ${task.level}`
  process.stdout.write(`${formatTask(label, outcome)}${kept}\n`)
}

const suite = scoreSuite(outcomes)
process.stdout.write(formatSuite(suite))
process.exit(suite.taskCount > 0 && suite.allPassRate >= threshold ? 0 : 1)
