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
  parserOptions: {
    ecmaVersion: 8
  },
  overrides: [
    {
      files: ["*-test.js"],
      env: {
        mocha: true
      }
    }
  ]
};
