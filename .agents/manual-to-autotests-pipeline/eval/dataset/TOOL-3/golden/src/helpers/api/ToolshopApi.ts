import type { APIRequestContext } from '@playwright/test'
import { AuthApi } from './AuthApi'
import { ContactApi } from './ContactApi'
import { ProductsApi } from './ProductsApi'

/** Typed client for the Toolshop REST API. Pass a token for authenticated calls. */
export class ToolshopApi {
  readonly auth: AuthApi
  readonly contact: ContactApi
  readonly products: ProductsApi

  constructor(request: APIRequestContext, token?: string) {
    this.auth = new AuthApi(request, token)
    this.contact = new ContactApi(request, token)
    this.products = new ProductsApi(request, token)
  }
}
