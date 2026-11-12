import {
  ContactField,
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
  validationErrorFor,
} from '@fixtures'

test(
  'Verify that the contact API rejects a sender name over the maximum length',
  { tag: [Tag.Api, Tag.Regression], annotation: testCase('TC-1') },
  async ({ toolshopApi }) => {
    await test.step('Verify that send a contact message whose name is 121 characters long', async () => {
      const response = await toolshopApi.contact.send(
        buildContactRequest({ name: textOfLength(ContactRules.overNameMaxLength) }),
      )
      expect(response.status(), 'Over-length name should be rejected').toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      await readJson(response, validationErrorFor(ContactField.Name))
    })
  },
)

test(
  'Verify that the contact API accepts a sender name of exactly the maximum length',
  { tag: [Tag.Api, Tag.Regression], annotation: testCase('TC-2') },
  async ({ toolshopApi }) => {
    test.fail(true, 'BUG: the service answers 500 for names of 100+ characters although AC-1 allows 120')

    await test.step('Verify that send a contact message whose name is exactly 120 characters long', async () => {
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
    await test.step('Verify that send a contact message with an email address of 257 characters', async () => {
      const response = await toolshopApi.contact.send(
        buildContactRequest({ email: emailOfLength(ContactRules.overEmailMaxLength) }),
      )
      expect(response.status(), 'Over-length email should be rejected').toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      await readJson(response, validationErrorFor(ContactField.Email))
    })

    await test.step('Confirm that send a contact message with an email address of exactly 256 characters', async () => {
      const email = emailOfLength(ContactRules.emailMaxLength)
      const response = await toolshopApi.contact.send(buildContactRequest({ email }))
      expect(response.status(), 'Maximum-length email should be accepted').toBe(HttpStatus.OK)
      expect(await response.json(), 'Response should echo the email').toMatchObject({ email })
    })

    await test.step('Verify that send a contact message with a subject of 121 characters', async () => {
      const response = await toolshopApi.contact.send(
        buildContactRequest({ subject: textOfLength(ContactRules.overSubjectMaxLength) }),
      )
      expect(response.status(), 'Over-length subject should be rejected').toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      await readJson(response, validationErrorFor(ContactField.Subject))
    })

    await test.step('Confirm that send a contact message with a subject of exactly 120 characters', async () => {
      const subject = textOfLength(ContactRules.subjectMaxLength)
      const response = await toolshopApi.contact.send(buildContactRequest({ subject }))
      expect(response.status(), 'Maximum-length subject should be accepted').toBe(HttpStatus.OK)
      expect(await response.json(), 'Response should echo the subject').toMatchObject({ subject })
    })
  },
)
