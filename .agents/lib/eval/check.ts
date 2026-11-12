export type CheckStatus = 'pass' | 'warn' | 'fail'

export type Check = { name: string; status: CheckStatus; detail?: string }

export const hasFailedCheck = (checks: Check[]): boolean => checks.some(c => c.status === 'fail')
