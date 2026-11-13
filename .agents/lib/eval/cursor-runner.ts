import { Agent, CursorAgentError } from '@cursor/sdk'

/** Runs one prompt in a workspace and returns the agent's answer. Tests can provide a fake. */
export type AgentRunner = (prompt: string, options: { workspace: string; model?: string }) => Promise<string>

/** Cursor SDK implementation of the reusable eval runner. */
export function createCursorRunner(apiKey = process.env.CURSOR_API_KEY ?? ''): AgentRunner {
  return async (prompt, { workspace, model }) => {
    const result = await Agent.prompt(prompt, { apiKey, model: { id: model ?? 'auto' }, local: { cwd: workspace } })
    if (result.status === 'error') throw new CursorAgentError(`agent run ${result.id} failed — inspect the workspace for partial output`)
    return result.result ?? ''
  }
}
