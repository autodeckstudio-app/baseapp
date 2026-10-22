// Dev-only: loads the Garage sample module only when __DEV__ is true. In a production export the branch is removed
// and metro.config.js blocks the sample file, so fake cars cannot ship. See scripts/prod-bundle-guard.mjs.
/* eslint-disable @typescript-eslint/consistent-type-imports -- dev-only require, type-only import() is intentional */
export const devGarage: typeof import("./garage-dev-sample").devGarage | null = __DEV__
  ? (require("./garage-dev-sample") as typeof import("./garage-dev-sample")).devGarage
  : null;
/* eslint-enable @typescript-eslint/consistent-type-imports */
