"use strict";

module.exports = {
  extends: ["eslint:recommended", "plugin:prettier/recommended"],
  parser: "@typescript-eslint/parser",
  env: {
    node: true,
    es6: true,
  },
  rules: {
    "no-var": "error",
    "prefer-const": "error",
    // no-unused-vars and no-redeclare are turned off,
    // because they do not work well with valid typescript code
    // the typescript compiler will catch these errors
    "no-unused-vars": "off",
    "no-redeclare": "off"
  },
  overrides: [
    {
      files: ["*-test.js"],
      env: {
        mocha: true,
      },
      parserOptions: { ecmaVersion: 2018 },
      rules: {
        "prefer-arrow-callback": "error",
      },
    },
  ],
};
