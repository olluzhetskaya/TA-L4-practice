export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  UNAUTHORIZED = 401,
  NOT_FOUND = 404,
  UNPROCESSABLE_ENTITY = 422,
}

export enum ContactSubject {
  CustomerService = 'customer-service',
  Webmaster = 'webmaster',
  Return = 'return',
  Payments = 'payments',
  Warranty = 'warranty',
  StatusOfOrder = 'status-of-order',
}

export const ContactSubjectLabel: Record<ContactSubject, string> = {
  [ContactSubject.CustomerService]: 'Customer service',
  [ContactSubject.Webmaster]: 'Webmaster',
  [ContactSubject.Return]: 'Return',
  [ContactSubject.Payments]: 'Payments',
  [ContactSubject.Warranty]: 'Warranty',
  [ContactSubject.StatusOfOrder]: 'Status of my order',
}

export enum MessageStatus {
  New = 'NEW',
}
