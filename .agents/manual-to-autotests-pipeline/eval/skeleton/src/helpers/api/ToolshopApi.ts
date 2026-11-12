import type { APIRequestContext } from '@playwright/test'
import { AuthApi } from './AuthApi'

/** Typed client for the Toolshop REST API. Pass a token for authenticated calls. */
export class ToolshopApi {
  readonly auth: AuthApi

  constructor(request: APIRequestContext, token?: string) {
    this.auth = new AuthApi(request, token)
  }
}
