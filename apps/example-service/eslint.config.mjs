import baseConfig from '@monorepo/eslint-config/base'

export default [
  ...baseConfig,
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
]
