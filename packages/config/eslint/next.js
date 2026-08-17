const base = require("./base");

/** @type {import("eslint").Linter.Config[]} */
const config = [
  ...base,
  {
    rules: {
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "@next/next/no-html-link-for-pages": "error",
    },
  },
];

module.exports = config;
