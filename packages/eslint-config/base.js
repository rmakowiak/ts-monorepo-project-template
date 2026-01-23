import pluginTypescript from '@typescript-eslint/eslint-plugin'
import parserTypescript from '@typescript-eslint/parser'
import pluginPrettier from 'eslint-plugin-prettier'

export default [
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['.eslintrc.js'],
    languageOptions: {
      parser: parserTypescript,
    },
    plugins: {
      pluginTypescript,
      pluginPrettier,
    },
    rules: {
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'padding-line-between-statements': [
        'error',
        { blankLine: 'never', prev: 'import', next: 'import' },
        { blankLine: 'always', prev: '*', next: 'export' },
      ],
    },
    settings: {
      env: {
        node: true,
        jest: true,
      },
    },
  },
]
