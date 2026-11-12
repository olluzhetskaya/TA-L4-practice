import 'dotenv/config'

/** CI passes unset repository variables as empty strings, so empty counts as unset. */
function fromEnv(name: string, fallback: string): string {
  const value = process.env[name]
  return value === undefined || value === '' ? fallback : value
}

export const env = {
  uiUrl: fromEnv('TOOLSHOP_UI_URL', 'https://practicesoftwaretesting.com'),
  apiUrl: fromEnv('TOOLSHOP_API_URL', 'https://api.practicesoftwaretesting.com'),
  customerEmail: fromEnv('TOOLSHOP_CUSTOMER_EMAIL', 'customer@practicesoftwaretesting.com'),
  customerPassword: fromEnv('TOOLSHOP_CUSTOMER_PASSWORD', 'welcome01'),
} as const

export const CUSTOMER_AUTH_FILE = '.auth/customer.json'
