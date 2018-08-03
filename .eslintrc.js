module.exports = {
  extends: ["eslint:recommended", "plugin:prettier/recommended"],
  env: {
    node: true
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
