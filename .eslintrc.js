module.exports = {
  root: true,
  parserOptions: {
    parser: '@babel/eslint-parser',
    ecmaVersion: 11,
    ecmaFeatures: {
      impliedStrict: true
    },
    sourceType: 'module'
  },
  env: {
    browser: true,
    es6: true,
    node: true
  },
  extends: [
    'standard',
    'eslint:recommended',
    'plugin:vue/base',
    'plugin:import/errors',
    'plugin:import/warnings'
  ],
  globals: {
    __static: true
  },
  plugins: ['html', 'vue', '@typescript-eslint'],
  rules: {
    // Two spaces but disallow semicolons
    indent: ['error', 2, { 'SwitchCase': 1, 'ignoreComments': true }],
    semi: [2, 'never'],
    'no-return-await': 'error',
    'no-return-assign': 'error',
    'no-new': 'error',
    // allow paren-less arrow functions
    'arrow-parens': 'off',
    // allow console
    'no-console': 'off',
    // allow debugger during development
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'require-atomic-updates': 'off',
    // TODO: fix these errors someday
    'prefer-const': 'off',
    'no-mixed-operators': 'off',
    'no-prototype-builtins': 'off'
  },
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: [
          './tsconfig.main.json',
          './tsconfig.renderer.json',
          './tsconfig.muya.json',
          './tsconfig.test.json'
        ],
        noWarnOnMultipleProjects: true
      },
      alias: {
        map: [
          ['common', './src/common'],
          // Normally only valid for renderer/
          ['@', './src/renderer'],
          ['muya', './src/muya']
        ],
        extensions: ['.js', '.ts', '.d.ts', '.vue', '.json', '.css', '.node']
      }
    }
  },
  overrides: [
    {
      files: ['**/*.ts'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 11,
        sourceType: 'module',
        project: [
          './tsconfig.main.json',
          './tsconfig.renderer.json',
          './tsconfig.muya.json',
          './tsconfig.test.json'
        ]
      },
      extends: ['plugin:@typescript-eslint/recommended'],
      rules: {
        'no-undef': 'off',
        'no-unused-vars': 'off',
        'node/no-missing-import': 'off',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }]
      }
    },
    {
      files: ['**/*.vue'],
      parser: 'vue-eslint-parser',
      parserOptions: {
        ecmaVersion: 11,
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
        parser: {
          js: '@babel/eslint-parser',
          ts: '@typescript-eslint/parser'
        }
      }
    }
  ],
  ignorePatterns: [
    'node_modules',
    'src/muya/dist/**/*',
    'src/muya/webpack.config.js'
  ]
}
