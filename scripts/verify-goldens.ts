import { createCursorRunner } from '../.agents/lib/eval/cursor-runner.ts'
import { formatSuite, formatTask } from '../.agents/lib/eval/report.ts'
import type { TaskOutcome } from '../.agents/lib/eval/run-task.ts'
import { scoreSuite } from '../.agents/lib/eval/score.ts'
import { loadEvalItems } from '../.agents/manual-to-autotests-pipeline/eval/dataset.ts'
import { goldenAgent } from '../.agents/manual-to-autotests-pipeline/eval/golden-agent.ts'
import { runSpecTask, tasksFor, type SpecTask } from '../.agents/manual-to-autotests-pipeline/eval/spec-task.ts'

const repoRoot = process.cwd()
const runSpecs = !process.argv.includes('--no-run')
const calibrateJudge = process.argv.includes('--judge')
const only = process.argv.slice(2).find(arg => !arg.startsWith('--'))

if (calibrateJudge && !process.env.CURSOR_API_KEY) {
  process.stderr.write('--judge needs CURSOR_API_KEY (see .env.example)\n')
  process.exit(2)
}
const judge = calibrateJudge ? { agent: createCursorRunner(), model: process.env.CURSOR_JUDGE_MODEL } : undefined

const outcomes: TaskOutcome<SpecTask>[] = []
for (const task of tasksFor(loadEvalItems(repoRoot)).filter(t => !only || t.item.ticket === only)) {
  const outcome = await runSpecTask(task, { repoRoot, agent: goldenAgent(task), runSpecs, judge })
  outcomes.push(outcome)
  const label = `${task.item.ticket} ${task.level}`
  process.stdout.write(`${formatTask(label, outcome)}\n`)
}

const suite = scoreSuite(outcomes)
process.stdout.write(formatSuite(suite))
const judgeCalibrated = !calibrateJudge || suite.judgePassRate === 1
process.exit(suite.allPassRate === 1 && judgeCalibrated ? 0 : 1)
