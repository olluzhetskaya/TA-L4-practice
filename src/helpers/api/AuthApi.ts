import type { APIResponse } from '@playwright/test'
import { z } from 'zod'
import { BaseApi } from './BaseApi'
import { readJson } from './readJson'

const tokenSchema = z.object({ access_token: z.string().min(1) })

export class AuthApi extends BaseApi {
  login(email: string, password: string): Promise<APIResponse> {
    return this.post('/users/login', { email, password })
  }

  async getToken(email: string, password: string): Promise<string> {
    const response = await this.login(email, password)
    if (!response.ok()) throw new Error(`Login failed for ${email}: HTTP ${response.status()}`)
    return (await readJson(response, tokenSchema)).access_token
  }
}
