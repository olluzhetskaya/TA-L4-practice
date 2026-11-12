import type { Check, CheckStatus } from './check.ts'
import type { TaskOutcome } from './run-task.ts'

export type TaskScore = {
  passed: boolean
  checkCount: number
  passCount: number
  passRate: number
}

export type CheckStat = Record<CheckStatus, number>

export type SuiteScore = {
  taskCount: number
  allPassCount: number
  allPassRate: number
  checkPassRate: number
  byCheck: Record<string, CheckStat>
  judgeCheckCount: number
  judgePassRate: number
}

const ratio = (part: number, total: number): number => (total === 0 ? 0 : part / total)

function scoreChecks(checks: Check[]): TaskScore {
  const passCount = checks.filter(c => c.status === 'pass').length
  return {
    passed: checks.length > 0 && checks.every(c => c.status !== 'fail'),
    checkCount: checks.length,
    passCount,
    passRate: ratio(passCount, checks.length),
  }
}

export const scoreTask = (outcome: TaskOutcome<unknown>): TaskScore => scoreChecks(outcome.checks)

export function scoreSuite(outcomes: TaskOutcome<unknown>[]): SuiteScore {
  const byCheck: Record<string, CheckStat> = {}
  let checkCount = 0
  let passCount = 0
  let allPassCount = 0
  let judgeCheckCount = 0
  let judgePassCount = 0
  for (const outcome of outcomes) {
    const score = scoreTask(outcome)
    if (score.passed) allPassCount++
    checkCount += score.checkCount
    passCount += score.passCount
    for (const check of outcome.checks) {
      const stat = (byCheck[check.name] ??= { pass: 0, fail: 0, warn: 0 })
      stat[check.status]++
    }
    const judged = scoreChecks(outcome.judgement)
    judgeCheckCount += judged.checkCount
    judgePassCount += judged.passCount
  }
  return {
    taskCount: outcomes.length,
    allPassCount,
    allPassRate: ratio(allPassCount, outcomes.length),
    checkPassRate: ratio(passCount, checkCount),
    byCheck,
    judgeCheckCount,
    judgePassRate: ratio(judgePassCount, judgeCheckCount),
  }
}
