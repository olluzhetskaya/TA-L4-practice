import { fail, pass, warn, type Gate } from './types.ts'

const HAS_HOST = /^[a-z][a-z0-9+.-]*:\/\//i

/**
 * API calls must record the live contract (pre-flight), not the test-case guess.
 * Fails on hosts in paths; warns when a new typed client method is still needed.
 */
export const apiGate: Gate = ({ exploration }) => {
  const problems: string[] = []
  for (const call of exploration.apiCalls) {
    if (!call.pathPattern.startsWith('/') || HAS_HOST.test(call.pathPattern))
      problems.push(`${call.id}: pathPattern must be a path starting with "/" (no host)`)
    if (call.auth === 'bearer' && !exploration.meta.authFile)
      problems.push(`${call.id}: bearer auth but meta.authFile is null`)
  }
  if (problems.length) return fail('api-calls', problems.slice(0, 4).join('; '))
  const missing = exploration.apiCalls.filter(c => c.needsClient).map(c => c.id)
  return missing.length
    ? warn('api-calls', `new typed client methods needed before the spec: ${missing.join(', ')}`)
    : pass('api-calls')
}
