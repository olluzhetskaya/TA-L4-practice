# TOOL-2: Contact service enforces field length limits

As a customer-service lead, I want the contact service to enforce maximum lengths on the sender fields so that oversized input is rejected with a clear error instead of corrupting stored messages.

## Acceptance Criteria

**AC-1** The sender name may be at most 120 characters. A longer name is rejected with a validation error that names the `name` field; a name of exactly 120 characters is accepted.

**AC-2** The email address may be at most 256 characters. A longer address is rejected with a validation error that names the `email` field; an address of exactly 256 characters is accepted.

**AC-3** The subject may be at most 120 characters. A longer subject is rejected with a validation error that names the `subject` field; a subject of exactly 120 characters is accepted.
