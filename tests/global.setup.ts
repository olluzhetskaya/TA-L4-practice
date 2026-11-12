import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { request } from '@playwright/test'
import { CUSTOMER_AUTH_FILE, env } from '@config/env'
import { ToolshopApi } from '@helpers/api/ToolshopApi'

/** Log in once per run and store the customer's bearer token for the `customerApi` fixture. */
export default async function globalSetup(): Promise<void> {
  const context = await request.newContext({ baseURL: env.apiUrl })
  const accessToken = await new ToolshopApi(context).auth.getToken(env.customerEmail, env.customerPassword)
  await context.dispose()
  mkdirSync(dirname(CUSTOMER_AUTH_FILE), { recursive: true })
  writeFileSync(CUSTOMER_AUTH_FILE, JSON.stringify({ access_token: accessToken }))
}
