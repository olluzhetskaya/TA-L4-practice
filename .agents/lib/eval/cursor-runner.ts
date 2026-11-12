import { Agent, CursorAgentError } from '@cursor/sdk'

/** Injectable agent seam. Swap in `createCursorRunner()` or any compatible implementation. */
export type AgentRunner = (prompt: string, options?: { model?: string; timeoutMs?: number; workspace?: string }) => Promise<string>

/**
 * Cursor SDK runner for eval tasks.
 *
 * Usage:
 *   import { createCursorRunner } from '.agents/lib/eval/cursor-runner.ts'
 *   const outcome = await runSpecTask(task, { repoRoot, agent: createCursorRunner() })
 *
 * Requires CURSOR_API_KEY in the environment.
 *
 * Two kinds of failure (handle them differently):
 *   - thrown CursorAgentError  → run never started (auth, config, network) — fix the environment
 *   - returned status "error"  → run started but failed mid-flight — inspect the workspace / transcript
 */
export function createCursorRunner(apiKey = process.env.CURSOR_API_KEY ?? ''): AgentRunner {
  return async (prompt, options = {}) => {
    const result = await Agent.prompt(prompt, {
      apiKey,
      model: { id: options.model ?? 'auto' },
      local: { cwd: options.workspace ?? process.cwd() },
    })
    if (result.status === 'error') {
      throw new CursorAgentError(`agent run ${result.id} failed — inspect the workspace for partial output`)
    }
    return result.result ?? ''
  }
}
