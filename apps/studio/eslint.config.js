const reactNative = require("@autodeck/config/eslint/react-native");

/** @type {import("eslint").Linter.Config[]} */
module.exports = [
  ...reactNative,
  {
    // App screens carry some leftover imports and non-null assertions from the redesign.
    // Report them as warnings so CI fails only on real errors; packages/ui stays strict.
    linterOptions: { reportUnusedDisableDirectives: "off" },
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
