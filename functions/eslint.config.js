const node = require("@autodeck/config/eslint/node");

/** @type {import("eslint").Linter.Config[]} */
module.exports = [
  ...node,
  {
    // Deployed handlers use a few non-null assertions after explicit checks. Warn, do not fail CI.
    rules: {
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
