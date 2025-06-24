import globals from 'globals'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'
import js from '@eslint/js'

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    plugins: { js },
    extends: ['js/recommended']
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    languageOptions: { globals: globals.node }
  },
  {
    files: ['**/*.js'],
    languageOptions: { sourceType: 'commonjs' }
  },
  tseslint.configs.recommended,
])
