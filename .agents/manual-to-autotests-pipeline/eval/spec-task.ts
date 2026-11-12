import { rmSync } from 'node:fs'
import { hasFailure, type GateResult } from '../../lib/gates/gateResults.ts'
import type { TestLevel } from '../input-validation/input-schemas.ts'
import { artifactPath, storyMdPath, testCasePath } from '../paths.ts'
import type { AgentRunner } from './cursor-runner.ts'
import type { EvalItem } from './dataset.ts'
import { gradeSpecs, type SpecGradeOptions } from './grade.ts'
import { judgeSpecs } from './judge.ts'
import { buildWorkspace } from './workspace.ts'

export type SpecTask = { level: TestLevel; item: EvalItem }

/** `judgement` is advisory and never part of `passed`. */
export type TaskOutcome = { task: SpecTask; workspace: string; gates: GateResult[]; judgement: GateResult[]; passed: boolean }

/** One spec task per test-case level the item has. */
export function tasksFor(items: EvalItem[], level?: TestLevel): SpecTask[] {
  const tasks = items.flatMap<SpecTask>(item => item.levels.map(l => ({ level: l, item })))
  return level ? tasks.filter(task => task.level === level) : tasks
}

/** What a person would ask in the agent chat — no skill is named, the agent has to pick it. */
export function promptFor(task: SpecTask): string {
  const { ticket } = task.item
  return `Automate the ${task.level} test cases for ${ticket}. Test cases: ${testCasePath(ticket)}. Story: ${storyMdPath(ticket)}. SUT analysis: ${artifactPath(ticket)}. Do not ask questions; finish autonomously.`
}

export type RunSpecTaskOptions = SpecGradeOptions & {
  agent: AgentRunner
  keepWorkspace?: boolean
  /** Also grade with the LLM judge (costs tokens). */
  judge?: { agent: AgentRunner; model?: string }
}

/** Stage a clean workspace, let the agent work in it, grade what it wrote, clean up. */
export async function runSpecTask(task: SpecTask, opts: RunSpecTaskOptions): Promise<TaskOutcome> {
  const workspace = buildWorkspace(opts.repoRoot, task.item)
  try {
    await opts.agent(promptFor(task), { workspace })
    const gates = gradeSpecs(task.item, task.level, workspace, opts)
    const judgement = opts.judge ? await judgeSpecs(task, workspace, opts.judge.agent, opts.judge.model) : []
    return { task, workspace, gates, judgement, passed: !hasFailure(gates) }
  } finally {
    if (!opts.keepWorkspace) rmSync(workspace, { recursive: true, force: true })
  }
}
