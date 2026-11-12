import {
  ContactField,
  ContactRules,
  ContactSubject,
  HttpStatus,
  InvalidContactData,
  MessageStatus,
  Tag,
  buildAuthenticatedContactRequest,
  buildContactRequest,
  buildContactRequestWithout,
  contactMessageSchema,
  expect,
  textOfLength,
  readJson,
  storedMessageSchema,
  test,
  testCase,
  validationErrorFor,
} from '@fixtures'

test(
  'Verify that the contact API rejects invalid messages and accepts a boundary-length message',
  { tag: [Tag.Api, Tag.Regression], annotation: testCase('TC-1') },
  async ({ toolshopApi }) => {
    test.info().annotations.push({
      type: 'gap',
      description:
        'TC-1 step 5 (49 characters → 422): the service accepts it; the 50-character minimum is a form rule and is asserted in TC-4.',
    })

    await test.step('Verify that send a contact message with a malformed email address', async () => {
      const response = await toolshopApi.contact.send(buildContactRequest({ email: InvalidContactData.malformedEmail }))
      expect(response.status(), 'Malformed email should be rejected').toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      await readJson(response, validationErrorFor(ContactField.Email))
    })

    await test.step('Verify that send a contact message without a subject', async () => {
      const response = await toolshopApi.contact.send(buildContactRequestWithout(ContactField.Subject))
      expect(response.status(), 'Missing subject should be rejected').toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      await readJson(response, validationErrorFor(ContactField.Subject))
    })

    await test.step('Verify that send a contact message of 251 characters', async () => {
      const response = await toolshopApi.contact.send(
        buildContactRequest({ message: textOfLength(ContactRules.overMaxLength) }),
      )
      expect(response.status(), 'Over-length message should be rejected').toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      await readJson(response, validationErrorFor(ContactField.Message))
    })

    await test.step('Confirm that send a contact message of exactly 250 characters', async () => {
      const message = textOfLength(ContactRules.messageMaxLength)
      const response = await toolshopApi.contact.send(buildContactRequest({ message }))
      expect(response.status(), 'Boundary-length message should be accepted').toBe(HttpStatus.OK)
      const created = await readJson(response, contactMessageSchema)
      expect(created, 'Response should echo the message with status NEW').toMatchObject({
        message,
        status: MessageStatus.New,
      })
    })
  },
)

test(
  "Verify that an authenticated customer's contact message is stored exactly as submitted",
  { tag: [Tag.Api, Tag.Regression], annotation: testCase('TC-2') },
  async ({ customerApi }) => {
    const payload = buildAuthenticatedContactRequest()

    const created = await test.step(
      'Verify that send a contact message as the signed-in customer',
      async () => {
        const response = await customerApi.contact.send(payload)
        expect(response.status(), 'Authenticated message should be accepted').toBe(HttpStatus.OK)
        const body = await readJson(response, storedMessageSchema)
        expect(body.status, 'New message should have status NEW').toBe(MessageStatus.New)
        return body
      },
    )

    await test.step('Confirm that read the stored message back by id as the same customer', async () => {
      const response = await customerApi.contact.getById(created.id)
      expect(response.status(), 'Stored message should be readable by its sender').toBe(HttpStatus.OK)
      const stored = await readJson(response, storedMessageSchema)
      expect(stored, 'Stored message should match the submission').toMatchObject({
        id: created.id,
        subject: ContactSubject.CustomerService,
        message: payload.message,
        status: MessageStatus.New,
      })
    })
  },
)
