import type { APIResponse } from '@playwright/test'
import { BaseApi } from './BaseApi'

export class ProductsApi extends BaseApi {
  search(query: string): Promise<APIResponse> {
    return this.get(`/products/search?q=${encodeURIComponent(query)}`)
  }
}
