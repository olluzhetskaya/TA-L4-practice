import type { Locator } from '@playwright/test'
import { BasePage } from './BasePage'

const HOME_PATH = '/'
const PRODUCT_HEADING_LEVEL = 5

export class ProductsPage extends BasePage {
  async open(): Promise<void> {
    await this.page.goto(HOME_PATH, { waitUntil: 'domcontentloaded' })
  }

  getSearchBox(): Locator {
    return this.page.getByRole('textbox', { name: 'Search' })
  }

  getSearchButton(): Locator {
    return this.page.getByRole('button', { name: 'Search' })
  }

  getSearchHeading(keyword: string): Locator {
    return this.page.getByRole('heading', { name: `Searched for: ${keyword}` })
  }

  getProductNames(): Locator {
    return this.page.getByRole('heading', { level: PRODUCT_HEADING_LEVEL })
  }

  getNoResultsMessage(text: string): Locator {
    return this.page.getByText(text)
  }

  async search(keyword: string): Promise<void> {
    await this.getSearchBox().fill(keyword)
    await this.getSearchButton().click()
  }
}
