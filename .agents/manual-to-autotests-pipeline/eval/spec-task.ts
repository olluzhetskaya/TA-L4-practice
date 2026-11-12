import type { Check } from '../../lib/eval/check.ts'
import type { AgentRunner } from '../../lib/eval/cursor-runner.ts'
import { runTask, type TaskOutcome } from '../../lib/eval/run-task.ts'
import type { GateResult } from '../../lib/gates/gateResults.ts'
import type { TestLevel } from '../input-validation/input-schemas.ts'
import { artifactPath, storyMdPath, testCasePath } from '../paths.ts'
import type { EvalItem } from './dataset.ts'
import { gradeSpecs, type SpecGradeOptions } from './grade.ts'
import { judgeSpecs } from './judge-specs.ts'
import { buildWorkspace } from './workspace.ts'

export type SpecTask = { level: TestLevel; item: EvalItem }

export type { TaskOutcome }

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

export const gradeTask = (task: SpecTask, workspace: string, opts: SpecGradeOptions): GateResult[] =>
  gradeSpecs(task.item, task.level, workspace, opts)

export const toChecks = (gates: GateResult[]): Check[] => gates.map(({ gate, status, detail }) => ({ name: gate, status, detail }))

export type RunSpecTaskOptions = SpecGradeOptions & {
  agent?: AgentRunner
  timeoutMs?: number
  keepWorkspace?: boolean
  /** Advisory rubric scoring of the written specs; it never affects `passed`. */
  judge?: { agent: AgentRunner; model?: string }
}

export async function runSpecTask(task: SpecTask, opts: RunSpecTaskOptions): Promise<TaskOutcome<SpecTask>> {
  const { judge } = opts
  return runTask(task, {
    ...opts,
    buildWorkspace: (root, t) => buildWorkspace(root, t.item),
    promptFor,
    gradeTask: (t, ws) => toChecks(gradeTask(t, ws, opts)),
    judgeTask: judge && ((t, ws) => judgeSpecs(t.item, t.level, ws, judge.agent, { model: judge.model, timeoutMs: opts.timeoutMs })),
  })
}
