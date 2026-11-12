import { z } from 'zod'

export enum ProductSearchKeyword {
  Pliers = 'pliers',
  NoMatch = 'zzzzzz',
}

export const ProductsCopy = {
  noResults: 'There are no products found.',
  searchedFor: (keyword: string) => `Searched for: ${keyword}`,
} as const

export const productSearchResponseSchema = z.object({
  data: z.array(z.object({ name: z.string().min(1) })),
})
