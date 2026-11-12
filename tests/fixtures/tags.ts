export enum Tag {
  Smoke = '@smoke',
  Regression = '@regression',
  Api = '@api',
  Ui = '@ui',
}

/** Links a Playwright test to its manual test case id in the HTML report. */
export const testCase = (id: string) => ({ type: 'test-case', description: id })
