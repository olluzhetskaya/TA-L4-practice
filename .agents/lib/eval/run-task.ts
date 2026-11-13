import { rmSync } from 'node:fs'
import { hasFailure, type GateResult } from '../gateResults.ts'
import type { AgentRunner } from './cursor-runner.ts'

export type EvalOutcome<TTask> = {
  task: TTask
  workspace: string
  gates: GateResult[]
  judgement: GateResult[]
  passed: boolean
}

export type RunEvalTaskOptions<TTask> = {
  agent: AgentRunner
  keepWorkspace?: boolean
  buildWorkspace: (task: TTask) => string
  promptFor: (task: TTask) => string
  grade: (task: TTask, workspace: string) => GateResult[] | Promise<GateResult[]>
  judge?: (task: TTask, workspace: string) => Promise<GateResult[]>
}

/** Build a disposable workspace, run an agent, grade its output, optionally judge it, then clean up. */
export async function runEvalTask<TTask>(task: TTask, opts: RunEvalTaskOptions<TTask>): Promise<EvalOutcome<TTask>> {
  const workspace = opts.buildWorkspace(task)
  try {
    await opts.agent(opts.promptFor(task), { workspace })
    const gates = await opts.grade(task, workspace)
    const judgement = (await opts.judge?.(task, workspace)) ?? []
    return { task, workspace, gates, judgement, passed: !hasFailure(gates) }
  } finally {
    if (!opts.keepWorkspace) rmSync(workspace, { recursive: true, force: true })
  }
}
