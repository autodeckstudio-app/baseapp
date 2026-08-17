const base = require("@autodeck/config/eslint/base");

/** @type {import("eslint").Linter.Config[]} */
module.exports = [
  ...base,
  {
    rules: {
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
    },
  },
];
