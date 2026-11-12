import type { APIResponse } from '@playwright/test'
import type { ContactRequest } from '@data/contact'
import { BaseApi } from './BaseApi'

export class ContactApi extends BaseApi {
  send(payload: Partial<ContactRequest>): Promise<APIResponse> {
    return this.post('/messages', payload)
  }

  getById(messageId: string): Promise<APIResponse> {
    return this.get(`/messages/${messageId}`)
  }
}
