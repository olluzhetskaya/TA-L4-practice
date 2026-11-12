import { readFileSync } from 'node:fs'
import { test as base } from '@playwright/test'
import { z } from 'zod'
import { CUSTOMER_AUTH_FILE, env } from '@config/env'
import { ToolshopApi } from '@helpers/api/ToolshopApi'
import { ContactPage } from '@pages/ContactPage'
import { ProductsPage } from '@pages/ProductsPage'

type ToolshopFixtures = {
  toolshopApi: ToolshopApi
  customerApi: ToolshopApi
  contactPage: ContactPage
  productsPage: ProductsPage
}

const authFileSchema = z.object({ access_token: z.string().min(1) })

function readCustomerToken(): string {
  const parsed = authFileSchema.safeParse(JSON.parse(readFileSync(CUSTOMER_AUTH_FILE, 'utf8')))
  if (!parsed.success) throw new Error(`${CUSTOMER_AUTH_FILE} is invalid — re-run the suite so global setup refreshes it`)
  return parsed.data.access_token
}

export const test = base.extend<ToolshopFixtures>({
  toolshopApi: async ({ playwright }, use) => {
    const request = await playwright.request.newContext({ baseURL: env.apiUrl })
    await use(new ToolshopApi(request))
    await request.dispose()
  },
  customerApi: async ({ playwright }, use) => {
    const request = await playwright.request.newContext({ baseURL: env.apiUrl })
    await use(new ToolshopApi(request, readCustomerToken()))
    await request.dispose()
  },
  contactPage: async ({ page }, use) => {
    await use(new ContactPage(page))
  },
  productsPage: async ({ page }, use) => {
    await use(new ProductsPage(page))
  },
})

export { expect } from '@playwright/test'
