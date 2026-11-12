import { z } from 'zod'
import type { components } from '@generated/toolshop-api'
import { ContactSubject, MessageStatus } from '@data/enums'

export type ContactRequest = components['schemas']['ContactRequest']

export const ContactRules = {
  messageMaxLength: 250,
  overMaxLength: 251,
  formMessageMinLength: 50,
  belowFormMinLength: 49,
  nameMaxLength: 120,
  overNameMaxLength: 121,
  emailMaxLength: 256,
  overEmailMaxLength: 257,
  subjectMaxLength: 120,
  overSubjectMaxLength: 121,
} as const

export const ContactCopy = {
  confirmation: 'Thanks for your message! We will contact you shortly.',
  messageTooShort: 'Message must be minimal 50 characters',
  requiredErrors: [
    'First name is required',
    'Last name is required',
    'Email is required',
    'Subject is required',
    'Message is required',
  ],
} as const

export const ContactFieldLabel = {
  firstName: 'First name',
  lastName: 'Last name',
  email: 'Email address',
  subject: 'Subject',
  message: 'Message',
} as const

export enum ContactField {
  Name = 'name',
  Email = 'email',
  Subject = 'subject',
  Message = 'message',
}

export const InvalidContactData = {
  malformedEmail: 'not-an-email',
} as const

export enum RequestCount {
  None = 0,
}

export type ContactFormInput = {
  firstName: string
  lastName: string
  email: string
  subject: ContactSubject
  message: string
}

const VALID_MESSAGE = 'TA-L4 automated test - please ignore this contact message.'

/** Text of exactly `length` characters. */
export const textOfLength = (length: number): string => 'x'.repeat(length)

const EMAIL_DOMAIN = '@example.com'

/** A syntactically valid email address of exactly `length` characters. */
export const emailOfLength = (length: number): string => `${'a'.repeat(length - EMAIL_DOMAIN.length)}${EMAIL_DOMAIN}`

export function buildContactForm(overrides: Partial<ContactFormInput> = {}): ContactFormInput {
  return {
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane.doe@example.com',
    subject: ContactSubject.CustomerService,
    message: VALID_MESSAGE,
    ...overrides,
  }
}

export function buildContactRequest(overrides: Partial<ContactRequest> = {}): ContactRequest {
  const form = buildContactForm()
  return {
    name: `${form.firstName} ${form.lastName}`,
    email: form.email,
    subject: form.subject,
    message: form.message,
    ...overrides,
  }
}

export function buildAuthenticatedContactRequest(): Pick<ContactRequest, 'subject' | 'message'> {
  const { subject, message } = buildContactRequest()
  return { subject, message }
}

export function buildContactRequestWithout(field: keyof ContactRequest): Partial<ContactRequest> {
  return Object.fromEntries(Object.entries(buildContactRequest()).filter(([key]) => key !== field))
}

export const contactMessageSchema = z.object({
  id: z.string().min(1),
  status: z.enum(MessageStatus),
  subject: z.string(),
  message: z.string(),
  created_at: z.string(),
})

export const storedMessageSchema = contactMessageSchema.extend({ user_id: z.string().min(1) })

export const validationErrorFor = (field: ContactField) => z.object({ [field]: z.array(z.string()).min(1) })
