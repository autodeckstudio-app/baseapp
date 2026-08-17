const base = require("./base");

/** @type {import("eslint").Linter.Config[]} */
const config = [
  ...base,
  {
    rules: {
      "no-process-env": "off",
    },
  },
];

module.exports = config;
