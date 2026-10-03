import js from '@eslint/js'
import globals from 'globals'

/**
 * ESLint con una sola regla activa: no-undef, que detecta
 * identificadores usados sin declarar.
 *
 * Motivo: en dos ocasiones un sitio desplegado quedo en blanco por
 * identificadores sin declarar (`useCallback` sin importar y
 * `minimoAlcanzado` inexistente). En los dos casos oxlint no aviso y
 * `vite build` termino sin error, porque ninguno de los dos comprueba
 * que el codigo se pueda ejecutar.
 *
 * Oxlint se mantiene como linter principal del proyecto (`npm run lint`)
 * por ser mucho mas rapido. ESLint se invoca aparte (`npm run lint:jsx`)
 * unicamente por esta regla, que oxlint no cubre.
 */
export default [
  {
    ignores: ['dist/**', 'node_modules/**', '.tmp-chrome-*/**'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2024,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // La regla que motivo toda esta configuracion.
      'no-undef': 'error',

      // El resto se desactiva: este archivo existe para una sola regla.
      'no-unused-vars': 'off',
      'no-redeclare': 'off',
      'no-dupe-class-members': 'off',
      'no-unreachable': 'off',
      'no-constant-condition': 'off',
      'no-empty': 'off',
      'no-prototype-builtins': 'off',
      'no-useless-escape': 'off',
      'no-control-regex': 'off',
      'no-fallthrough': 'off',
      'no-cond-assign': 'off',
      'require-yield': 'off',
      'no-unsafe-optional-chaining': 'off',
    },
  },
]