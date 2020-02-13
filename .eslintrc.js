"use strict";

module.exports = {
  extends: ["eslint:recommended", "plugin:prettier/recommended"],
  env: {
    node: true,
    es6: true
  },
  rules: {
    "no-var": "error",
    "prefer-const": "error",
    strict: "error"
  },
  overrides: [
    {
      files: ["*-test.js"],
      env: {
        mocha: true
      },
      parserOptions: { ecmaVersion: 2018 },
      rules: {
        "prefer-arrow-callback": "error"
      }
    }
  ]
};
