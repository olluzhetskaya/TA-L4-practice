# TOOL-1: Contact customer service from the storefront

As a shopper, I want to send a message to customer service from the contact page so that I get help with an order, a return, or a product question.

## Acceptance Criteria

**AC-1** A visitor can submit the contact form with first name, last name, email address, a subject, and a message. After a successful submission the form is replaced by the confirmation "Thanks for your message! We will contact you shortly."

**AC-2** A message shorter than 50 characters is rejected on the form with the text "Message must be minimal 50 characters". Nothing is sent to the server.

**AC-3** First name, last name, email address, subject, and message are required. Submitting an empty form shows "<Field> is required" next to every empty field and sends nothing.

**AC-4** The contact service rejects a message longer than 250 characters with a validation error that names the `message` field. A message of exactly 250 characters is accepted.

**AC-5** The contact service rejects a malformed email address with a validation error that names the `email` field.

**AC-6** The contact service requires a subject and rejects a request without one with a validation error that names the `subject` field.

**AC-7** An accepted message is stored exactly as submitted, with status `NEW`. A signed-in customer can read their stored message back by id.
