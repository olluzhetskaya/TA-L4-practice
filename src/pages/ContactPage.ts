import type { Locator, Request } from '@playwright/test'
import { ContactFieldLabel, type ContactFormInput } from '@data/contact'
import { ContactSubjectLabel } from '@data/enums'
import { env } from '@config/env'
import { BasePage } from './BasePage'

const CONTACT_PATH = '/contact'
const MESSAGES_PATH = '/messages'

export type SubmissionTracker = { count: () => number }

export class ContactPage extends BasePage {
  async open(): Promise<void> {
    await this.page.goto(CONTACT_PATH, { waitUntil: 'domcontentloaded' })
  }

  getFirstNameInput(): Locator {
    return this.page.getByLabel(ContactFieldLabel.firstName)
  }

  getLastNameInput(): Locator {
    return this.page.getByLabel(ContactFieldLabel.lastName)
  }

  getEmailInput(): Locator {
    return this.page.getByLabel(ContactFieldLabel.email)
  }

  getSubjectSelect(): Locator {
    return this.page.getByRole('combobox', { name: ContactFieldLabel.subject })
  }

  getMessageInput(): Locator {
    return this.page.getByRole('textbox', { name: ContactFieldLabel.message })
  }

  getSendButton(): Locator {
    return this.page.getByRole('button', { name: 'Send' })
  }

  getAlert(text: string): Locator {
    return this.page.getByRole('alert').filter({ hasText: text })
  }

  async fillForm(input: ContactFormInput): Promise<void> {
    await this.getFirstNameInput().fill(input.firstName)
    await this.getLastNameInput().fill(input.lastName)
    await this.getEmailInput().fill(input.email)
    await this.getSubjectSelect().selectOption({ label: ContactSubjectLabel[input.subject] })
    await this.getMessageInput().fill(input.message)
  }

  async submit(): Promise<void> {
    await this.getSendButton().click()
  }

  /** Count POST /messages requests the form sends — the only way to observe "nothing was sent". */
  trackSubmissions(): SubmissionTracker {
    let sent = 0
    const isSubmission = (request: Request) =>
      request.method() === 'POST' && request.url() === `${env.apiUrl}${MESSAGES_PATH}`
    this.page.on('request', request => {
      if (isSubmission(request)) sent += 1
    })
    return { count: () => sent }
  }
}
