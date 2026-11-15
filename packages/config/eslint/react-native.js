const base = require("./base");

/** @type {import("eslint").Linter.Config[]} */
const config = [
  ...base,
  {
    rules: {
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
    },
  },
];

module.exports = config;
