import {
  ProductSearchKeyword,
  ProductsCopy,
  Tag,
  expect,
  productSearchResponseSchema,
  readJson,
  test,
  testCase,
} from '@fixtures'

test(
  'Verify that searching by keyword lists the matching products',
  { tag: [Tag.Ui, Tag.Regression], annotation: testCase('TC-1') },
  async ({ productsPage, toolshopApi }) => {
    const keyword = ProductSearchKeyword.Pliers
    const catalogue = await readJson(await toolshopApi.products.search(keyword), productSearchResponseSchema)
    const expectedNames = catalogue.data.map(product => product.name)

    await test.step('Verify that the search shows the keyword heading', async () => {
      await productsPage.open()
      await productsPage.search(keyword)
      await expect(productsPage.getSearchHeading(keyword), 'Keyword heading should be displayed').toBeVisible()
    })

    await test.step('Confirm that the page lists exactly the products the catalogue returns', async () => {
      await expect(productsPage.getProductNames(), 'Listed products should match the catalogue search').toHaveText(
        expectedNames,
      )
    })
  },
)

test(
  'Verify that a search without matches shows the empty state',
  { tag: [Tag.Ui, Tag.Regression], annotation: testCase('TC-2') },
  async ({ productsPage }) => {
    const keyword = ProductSearchKeyword.NoMatch

    await test.step('Verify that the search shows the keyword heading and the no-results message', async () => {
      await productsPage.open()
      await productsPage.search(keyword)
      await expect(productsPage.getSearchHeading(keyword), 'Keyword heading should be displayed').toBeVisible()
      await expect(
        productsPage.getNoResultsMessage(ProductsCopy.noResults),
        'No-results message should be displayed',
      ).toBeVisible()
    })

    await test.step('Confirm that no product cards are listed', async () => {
      await expect(productsPage.getProductNames(), 'No product should be listed').toHaveCount(0)
    })
  },
)
