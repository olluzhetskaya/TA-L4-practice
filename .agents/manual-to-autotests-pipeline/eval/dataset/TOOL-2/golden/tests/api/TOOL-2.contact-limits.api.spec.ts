import {
  ContactRules,
  HttpStatus,
  MessageStatus,
  Tag,
  buildContactRequest,
  emailOfLength,
  expect,
  readJson,
  test,
  testCase,
  textOfLength,
  validationErrorsSchema,
} from '@fixtures'

test(
  'Verify that the contact API rejects a sender name over the maximum length',
  { tag: [Tag.Api, Tag.Regression], annotation: testCase('TC-1') },
  async ({ toolshopApi }) => {
    await test.step('Verify that a name over the maximum length is rejected and named in the error', async () => {
      const response = await toolshopApi.contact.send(
        buildContactRequest({ name: textOfLength(ContactRules.overNameMaxLength) }),
      )
      expect(response.status(), 'Over-length name should be rejected').toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      const errors = await readJson(response, validationErrorsSchema)
      expect(Object.keys(errors), 'Validation error should name the name field').toEqual(['name'])
    })
  },
)

test(
  'Verify that the contact API accepts a sender name of exactly the maximum length',
  { tag: [Tag.Api, Tag.Regression], annotation: testCase('TC-2') },
  async ({ toolshopApi }) => {
    test.fail(true, 'BUG: the service answers 500 for names of 100+ characters although AC-1 allows 120')

    await test.step('Verify that a name of exactly the maximum length is accepted and echoed', async () => {
      const name = textOfLength(ContactRules.nameMaxLength)
      const response = await toolshopApi.contact.send(buildContactRequest({ name }))
      expect(response.status(), 'Maximum-length name should be accepted').toBe(HttpStatus.OK)
      expect(await response.json(), 'Response should echo the name with status NEW').toMatchObject({
        name,
        status: MessageStatus.New,
      })
    })
  },
)

test(
  'Verify that the contact API enforces the email and subject length limits',
  { tag: [Tag.Api, Tag.Regression], annotation: testCase('TC-3') },
  async ({ toolshopApi }) => {
    await test.step('Verify that an email over the maximum length is rejected and named in the error', async () => {
      const response = await toolshopApi.contact.send(
        buildContactRequest({ email: emailOfLength(ContactRules.overEmailMaxLength) }),
      )
      expect(response.status(), 'Over-length email should be rejected').toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      const errors = await readJson(response, validationErrorsSchema)
      expect(Object.keys(errors), 'Validation error should name the email field').toEqual(['email'])
    })

    await test.step('Confirm that an email of exactly the maximum length is accepted and echoed', async () => {
      const email = emailOfLength(ContactRules.emailMaxLength)
      const response = await toolshopApi.contact.send(buildContactRequest({ email }))
      expect(response.status(), 'Maximum-length email should be accepted').toBe(HttpStatus.OK)
      expect(await response.json(), 'Response should echo the email').toMatchObject({ email })
    })

    await test.step('Verify that a subject over the maximum length is rejected and named in the error', async () => {
      const response = await toolshopApi.contact.send(
        buildContactRequest({ subject: textOfLength(ContactRules.overSubjectMaxLength) }),
      )
      expect(response.status(), 'Over-length subject should be rejected').toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      const errors = await readJson(response, validationErrorsSchema)
      expect(Object.keys(errors), 'Validation error should name the subject field').toEqual(['subject'])
    })

    await test.step('Confirm that a subject of exactly the maximum length is accepted and echoed', async () => {
      const subject = textOfLength(ContactRules.subjectMaxLength)
      const response = await toolshopApi.contact.send(buildContactRequest({ subject }))
      expect(response.status(), 'Maximum-length subject should be accepted').toBe(HttpStatus.OK)
      expect(await response.json(), 'Response should echo the subject').toMatchObject({ subject })
    })
  },
)
