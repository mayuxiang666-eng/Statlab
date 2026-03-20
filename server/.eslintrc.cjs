module.exports = {
  env: {
    node: true,
    es2020: true
  },
  extends: ["eslint:recommended", "plugin:import/recommended", "prettier"],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module"
  },
  rules: {
    "import/no-unresolved": 0,
    "@typescript-eslint/no-var-requires": 0
  },
  overrides: [
    {
      files: ["**/*.ts"],
      parser: "@typescript-eslint/parser",
      plugins: ["@typescript-eslint"],
      extends: ["plugin:@typescript-eslint/recommended"],
      rules: {
        "@typescript-eslint/no-explicit-any": 0
      }
    }
  ]
};
