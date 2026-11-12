import type { APIRequestContext, APIResponse } from '@playwright/test'

export abstract class BaseApi {
  constructor(
    protected readonly request: APIRequestContext,
    private readonly token?: string,
  ) {}

  private headers(): Record<string, string> {
    return { Accept: 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) }
  }

  protected get(path: string): Promise<APIResponse> {
    return this.request.get(path, { headers: this.headers() })
  }

  protected post(path: string, data: object): Promise<APIResponse> {
    return this.request.post(path, { headers: this.headers(), data })
  }
}
