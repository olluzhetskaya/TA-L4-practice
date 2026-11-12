import 'dotenv/config'

export const env = {
  uiUrl: process.env.TOOLSHOP_UI_URL ?? 'https://practicesoftwaretesting.com',
  apiUrl: process.env.TOOLSHOP_API_URL ?? 'https://api.practicesoftwaretesting.com',
  customerEmail: process.env.TOOLSHOP_CUSTOMER_EMAIL ?? 'customer@practicesoftwaretesting.com',
  customerPassword: process.env.TOOLSHOP_CUSTOMER_PASSWORD ?? 'welcome01',
} as const

export const CUSTOMER_AUTH_FILE = '.auth/customer.json'
