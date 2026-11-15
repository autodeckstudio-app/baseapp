// Dev-only: loads the catalogue sample module only when __DEV__ is true. In a production export the
// `__DEV__ ? require(...) : null` branch is eliminated before bundling and metro.config.js blocks
// the sample file, so sample services cannot ship. See scripts/prod-bundle-guard.mjs.
// Outside Metro (vitest node environment) the relative require cannot resolve: fall back to no mock.
import type { devCatalogueSeed as catalogueDevSample } from "./catalogue-dev-sample";

type SampleModule = { devCatalogueSeed: typeof catalogueDevSample };
let sample: SampleModule | null = null;
try {
  sample = __DEV__ ? (require("./catalogue-dev-sample") as SampleModule) : null;
} catch {
  sample = null;
}

export const devCatalogue: typeof catalogueDevSample | null = sample ? sample.devCatalogueSeed : null;
