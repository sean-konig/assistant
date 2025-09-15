import base from "@repo/eslint-config/base";

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...base,
  {
    languageOptions: { parserOptions: { project: false } },
    rules: {},
  },
]

