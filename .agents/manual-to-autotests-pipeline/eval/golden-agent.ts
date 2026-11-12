import type { AgentRunner } from './cursor-runner.ts'
import type { SpecTask } from './spec-task.ts'
import { overlayGolden } from './workspace.ts'

/** Stand-in for the Cursor agent that "does the task" by copying the golden output: calibrates the graders without a live run. */
export const goldenAgent =
  (task: SpecTask): AgentRunner =>
  async (_prompt, { workspace }) => {
    overlayGolden(workspace, task.item)
    return 'golden'
  }
