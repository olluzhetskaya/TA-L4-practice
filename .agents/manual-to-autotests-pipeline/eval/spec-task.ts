import type { AgentRunner } from '../../lib/eval/cursor-runner.ts'
import { runEvalTask, type EvalOutcome } from '../../lib/eval/run-task.ts'
import type { TestLevel } from '../input-validation/input-schemas.ts'
import { artifactPath, storyMdPath, testCasePath } from '../paths.ts'
import type { EvalItem } from './dataset.ts'
import { gradeSpecs, type SpecGradeOptions } from './grade.ts'
import { judgeSpecs } from './judge.ts'
import { buildWorkspace } from './workspace.ts'

export type SpecTask = { level: TestLevel; item: EvalItem }

/** `judgement` is advisory and never part of `passed`. */
export type TaskOutcome = EvalOutcome<SpecTask>

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
  return runEvalTask(task, {
    agent: opts.agent,
    keepWorkspace: opts.keepWorkspace,
    buildWorkspace: current => buildWorkspace(opts.repoRoot, current.item),
    promptFor,
    grade: (current, workspace) => gradeSpecs(current.item, current.level, workspace, opts),
    judge: opts.judge
      ? (current, workspace) => judgeSpecs(current, workspace, opts.judge?.agent ?? opts.agent, opts.judge?.model)
      : undefined,
  })
}
