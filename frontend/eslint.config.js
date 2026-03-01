import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import importPlugin from 'eslint-plugin-import'

// Files that belong to the test/spec world or have special parse requirements
const TEST_FILE_PATTERNS = [
  'src/**/*.test.ts',
  'src/**/*.test.tsx',
  'src/**/__tests__/**/*.ts',
  'src/**/__tests__/**/*.tsx',
  'src/test/**/*.ts',
  'src/test/**/*.tsx',
  'src/tests/**/*.ts',
  'src/tests/**/*.tsx',
  // react-global.tsx shadows react-global.ts — TS won't include both, so use test tsconfig
  'src/react-global.tsx',
]

const COMMON_PLUGINS = {
  '@typescript-eslint': tseslint.plugin,
  'react-hooks': reactHooks,
  'react-refresh': reactRefresh,
  'import': importPlugin,
}

const COMMON_RULES = {
  ...js.configs.recommended.rules,
  ...tseslint.configs.recommended.rules,
  ...reactHooks.configs.recommended.rules,

  // Ignore underscore-prefixed parameters (commonly used in callbacks)
  'no-unused-vars': 'off',
  '@typescript-eslint/no-unused-vars': ['error', {
    argsIgnorePattern: '^_',
    varsIgnorePattern: '^_',
    caughtErrorsIgnorePattern: '^_'
  }],

  // Allow TypeScript const + type with same name (e.g. usePermissions.ts)
  'no-redeclare': 'off',

  // Import rules
  'import/no-unresolved': 'error',
  'import/named': 'error',
  'import/default': 'error',
  'import/namespace': 'error',
  'import/export': 'error',
  'import/no-named-as-default': 'warn',
  'import/no-named-as-default-member': 'warn',
  'import/no-duplicates': 'error',

  // React Refresh
  'react-refresh/only-export-components': [
    'warn',
    { allowConstantExport: true },
  ],
}

export default [
  // ── Global ignores ──────────────────────────────────────────────────────────
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'e2e/**',
      'playwright-report/**',
      'test-results/**',
      'deploy.ts',
      '*.config.js',
      '*.config.ts',
      'vite.config.ts',
      'vitest.config.ts',
      'playwright.config.ts'
    ]
  },

  // ── Test files (tsconfig.test.json includes everything in src/) ─────────────
  {
    files: TEST_FILE_PATTERNS,
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node, ...globals.jest },
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.test.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: COMMON_PLUGINS,
    rules: {
      ...COMMON_RULES,

      // TypeScript type-aware rules — relaxed for test code
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      // async json() { return data; } is a valid mock pattern — suppress false positives
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/prefer-optional-chain': 'off',
      '@typescript-eslint/prefer-readonly': 'off',

      // Keep promise safety in tests
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/prefer-as-const': 'error',
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.test.json',
        },
      },
    },
  },

  // ── Source files (tsconfig.app.json — excludes tests) ──────────────────────
  {
    files: ['**/*.{ts,tsx}'],
    ignores: TEST_FILE_PATTERNS,
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.app.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: COMMON_PLUGINS,
    rules: {
      ...COMMON_RULES,

      // TypeScript strict rules for production code
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      // These strict rules generate too many false positives in existing code
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/prefer-optional-chain': 'off',
      '@typescript-eslint/prefer-readonly': 'off',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/prefer-as-const': 'error',
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.app.json',
        },
      },
    },
  },

  // ── Feature boundary rules — features cannot import from other features ────
  {
    files: ['src/features/**/*.{ts,tsx}', 'src/shared/**/*.{ts,tsx}'],
    ignores: TEST_FILE_PATTERNS,
    rules: {
      'import/no-restricted-paths': ['error', {
        zones: [
          // Features cannot import from other features (compose at portal level)
          {
            target: './src/features/auth/**',
            from: './src/features/!(auth)/**',
            message: 'Features must not import from other features. Compose at the portal level instead.',
          },
          {
            target: './src/features/pitches/**',
            from: './src/features/!(pitches)/**',
            message: 'Features must not import from other features. Compose at the portal level instead.',
          },
          {
            target: './src/features/ndas/**',
            from: './src/features/!(ndas)/**',
            message: 'Features must not import from other features. Compose at the portal level instead.',
          },
          {
            target: './src/features/deals/**',
            from: './src/features/!(deals)/**',
            message: 'Features must not import from other features. Compose at the portal level instead.',
          },
          {
            target: './src/features/messaging/**',
            from: './src/features/!(messaging)/**',
            message: 'Features must not import from other features. Compose at the portal level instead.',
          },
          {
            target: './src/features/notifications/**',
            from: './src/features/!(notifications)/**',
            message: 'Features must not import from other features. Compose at the portal level instead.',
          },
          {
            target: './src/features/browse/**',
            from: './src/features/!(browse)/**',
            message: 'Features must not import from other features. Compose at the portal level instead.',
          },
          {
            target: './src/features/analytics/**',
            from: './src/features/!(analytics)/**',
            message: 'Features must not import from other features. Compose at the portal level instead.',
          },
          {
            target: './src/features/billing/**',
            from: './src/features/!(billing)/**',
            message: 'Features must not import from other features. Compose at the portal level instead.',
          },
          {
            target: './src/features/uploads/**',
            from: './src/features/!(uploads)/**',
            message: 'Features must not import from other features. Compose at the portal level instead.',
          },
          // Shared layer cannot import from features or portals
          {
            target: './src/shared/**',
            from: './src/features/**',
            message: 'Shared layer must not import from features. Move shared code to shared/ instead.',
          },
          {
            target: './src/shared/**',
            from: './src/portals/**',
            message: 'Shared layer must not import from portals.',
          },
        ],
      }],
    },
  },

  // ── Special: react-global.tsx ───────────────────────────────────────────────
  // Both react-global.ts and react-global.tsx exist. TypeScript module resolution
  // picks only the .ts file, so the .tsx is not included in any tsconfig project.
  // Disable all type-aware rules for this stub file.
  {
    files: ['src/react-global.tsx'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parser: tseslint.parser,
      parserOptions: {
        project: false,
      },
    },
    plugins: COMMON_PLUGINS,
    rules: {
      ...COMMON_RULES,
      // All type-aware rules must be off when project: false
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/await-thenable': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/prefer-as-const': 'off',
      '@typescript-eslint/prefer-optional-chain': 'off',
      '@typescript-eslint/prefer-readonly': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
    },
  },
]
