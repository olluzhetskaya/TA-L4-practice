import {
  ContactCopy,
  ContactRules,
  ContactSubjectLabel,
  RequestCount,
  Tag,
  buildContactForm,
  expect,
  textOfLength,
  test,
  testCase,
} from '@fixtures'

test(
  'Verify that a visitor can send a message through the contact form',
  { tag: [Tag.Ui, Tag.Smoke, Tag.Regression], annotation: testCase('TC-3') },
  async ({ contactPage }) => {
    const form = buildContactForm()

    await test.step(
      'Verify that fill in first name, last name, email address, choose a subject, and enter a message of at least 50 characters',
      async () => {
      await contactPage.open()
      await contactPage.fillForm(form)
      await expect(contactPage.getFirstNameInput(), 'First name should hold the entry').toHaveValue(form.firstName)
      await expect(contactPage.getLastNameInput(), 'Last name should hold the entry').toHaveValue(form.lastName)
      await expect(contactPage.getEmailInput(), 'Email should hold the entry').toHaveValue(form.email)
      await expect(contactPage.getSubjectSelect(), 'Subject should show the chosen option').toHaveText(
        new RegExp(ContactSubjectLabel[form.subject]),
      )
      await expect(contactPage.getMessageInput(), 'Message should hold the entry').toHaveValue(form.message)
      },
    )

    await test.step('Confirm that send the form', async () => {
      await contactPage.submit()
      await expect(contactPage.getAlert(ContactCopy.confirmation), 'Confirmation should replace the form').toBeVisible()
    })
  },
)

test(
  'Verify that the contact form blocks invalid input before sending',
  { tag: [Tag.Ui, Tag.Regression], annotation: testCase('TC-4') },
  async ({ contactPage }) => {
    await contactPage.open()
    const submissions = contactPage.trackSubmissions()

    await test.step('Verify that send the empty form', async () => {
      await contactPage.submit()
      for (const text of ContactCopy.requiredErrors)
        await expect(contactPage.getAlert(text), `"${text}" should be displayed`).toBeVisible()
      expect(submissions.count(), 'No request should be sent for an empty form').toBe(RequestCount.None)
    })

    await test.step(
      'Confirm that fill every field but enter a message of 49 characters, then send the form',
      async () => {
      await contactPage.fillForm(buildContactForm({ message: textOfLength(ContactRules.belowFormMinLength) }))
      await contactPage.submit()
      await expect(contactPage.getAlert(ContactCopy.messageTooShort), 'Minimum-length error should be displayed').toBeVisible()
        expect(submissions.count(), 'No request should be sent for a too-short message').toBe(RequestCount.None)
      },
    )
  },
)
