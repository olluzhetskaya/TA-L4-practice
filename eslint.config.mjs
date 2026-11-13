import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import sonarjs from 'eslint-plugin-sonarjs'
import playwright from 'eslint-plugin-playwright'
import globals from 'globals'

const testCode = ['tests/**/*.ts', 'src/**/*.ts']

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'playwright-report/**',
      'test-results/**',
      'src/types/generated/**',
      '.agents/manual-to-autotests-pipeline/eval/dataset/**',
      '.agents/manual-to-autotests-pipeline/eval/skeleton/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: { allowDefaultProject: ['eslint.config.mjs'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  // Harness scripts: SonarJS + the strict AGENTS.md TypeScript rules.
  {
    ...sonarjs.configs.recommended,
    files: ['.agents/**/*.ts', 'scripts/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      ...sonarjs.configs.recommended.rules,
      'sonarjs/cognitive-complexity': ['error', 30],
      'sonarjs/no-nested-conditional': 'off',
      'sonarjs/no-console': 'off',
      'sonarjs/fixme-tag': 'off',
      'sonarjs/todo-tag': 'off',
      'sonarjs/slow-regex': 'off',
      'sonarjs/os-command': 'off',
      'sonarjs/no-os-command-from-path': 'off',
      'sonarjs/publicly-writable-directories': 'off',
      'sonarjs/no-clear-text-protocols': 'off',
    },
  },
  {
    files: ['.agents/**/*.ts', 'scripts/**/*.ts', ...testCode],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  // Framework code (AGENTS.md): Playwright rules, no deep relative imports, no eslint-disable.
  {
    ...playwright.configs['flat/recommended'],
    files: testCode,
    languageOptions: { globals: globals.node },
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      'playwright/no-wait-for-timeout': 'error',
      'playwright/expect-expect': 'error',
      'playwright/no-conditional-in-test': 'error',
      'playwright/prefer-web-first-assertions': 'error',
      'playwright/no-skipped-test': ['error', { allowConditional: true }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../../*', '../../../*'],
              message: 'Use a tsconfig path alias (@data/*, @pages/*, @helpers/*, @fixtures) instead of crossing two directories.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['tests/**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?!@fixtures$).*',
              message: 'Specs import only from @fixtures; expose dependencies through the fixture barrel.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['tests/fixtures/**/*.ts'],
    rules: { 'no-empty-pattern': 'off' },
  },
  {
    linterOptions: { reportUnusedDisableDirectives: 'error' },
  },
]
