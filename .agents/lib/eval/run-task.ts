import { rmSync } from 'node:fs'
import { hasFailedCheck, type Check } from './check.ts'
import type { AgentRunner } from './cursor-runner.ts'

export type TaskRunnerOptions<TTask> = {
  repoRoot: string
  agent?: AgentRunner
  timeoutMs?: number
  keepWorkspace?: boolean
  buildWorkspace: (repoRoot: string, task: TTask) => string
  promptFor: (task: TTask) => string
  gradeTask: (task: TTask, workspace: string) => Check[] | Promise<Check[]>
  /** Advisory scoring after grading (for example a rubric judge). It never affects `passed`. */
  judgeTask?: (task: TTask, workspace: string) => Promise<Check[]>
}

export type TaskOutcome<TTask> = {
  task: TTask
  workspace: string
  agentOutput: string
  checks: Check[]
  judgement: Check[]
  passed: boolean
}

/** Stage a workspace, run the agent, grade the output, clean up. Delegates all pipeline knowledge to callbacks. */
export async function runTask<TTask>(task: TTask, opts: TaskRunnerOptions<TTask>): Promise<TaskOutcome<TTask>> {
  const workspace = opts.buildWorkspace(opts.repoRoot, task)
  try {
    if (!opts.agent) throw new Error('No agent runner provided — wire the Cursor SDK or CLI (see Phase 8).')
    const agentOutput = await opts.agent(opts.promptFor(task), { workspace, timeoutMs: opts.timeoutMs })
    const checks = await opts.gradeTask(task, workspace)
    const judgement = (await opts.judgeTask?.(task, workspace)) ?? []
    return { task, workspace, agentOutput, checks, judgement, passed: !hasFailedCheck(checks) }
  } finally {
    if (!opts.keepWorkspace) rmSync(workspace, { recursive: true, force: true })
  }
}
