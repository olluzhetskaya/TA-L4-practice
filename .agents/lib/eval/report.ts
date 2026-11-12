import type { TaskOutcome } from './run-task.ts'
import type { SuiteScore } from './score.ts'

const percent = (rate: number): string => `${(rate * 100).toFixed(1)}%`

const failing = (checks: { name: string; status: string; detail?: string }[]): string =>
  checks
    .filter(check => check.status === 'fail')
    .map(check => `\n       ${check.name}: ${check.detail ?? ''}`)
    .join('')

/** One line per task: ok or FAIL, then the failed checks and failed judge criteria. */
export function formatTask(label: string, outcome: TaskOutcome<unknown>): string {
  const bad = outcome.checks.some(check => check.status === 'fail')
  return `${bad ? 'FAIL' : 'ok  '} ${label}${failing(outcome.checks)}${failing(outcome.judgement)}`
}

export function formatSuite(suite: SuiteScore): string {
  const lines = [
    '',
    `tasks passed: ${suite.allPassCount}/${suite.taskCount} (${percent(suite.allPassRate)}); checks passed: ${percent(suite.checkPassRate)}`,
    ...Object.entries(suite.byCheck)
      .filter(([, stat]) => stat.fail > 0)
      .map(([name, stat]) => `  ${name}: ${stat.fail} failed, ${stat.pass} passed`),
  ]
  if (suite.judgeCheckCount > 0)
    lines.push(`judge criteria passed (advisory): ${percent(suite.judgePassRate)} of ${suite.judgeCheckCount}`)
  return `${lines.join('\n')}\n`
}
