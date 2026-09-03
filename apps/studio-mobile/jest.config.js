/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      { tsconfig: { module: 'CommonJS', moduleResolution: 'Node', jsx: 'react-jsx', esModuleInterop: true } },
    ],
  },
  testRegex: '.*\\.spec\\.tsx?$',
  // Phase 3A: tests here are all pure-logic (session-state derivation, API
  // client wiring) — no component rendering, so no React Native Testing
  // Library / jest-expo preset is needed. Screen/navigation components are
  // exercised via the Expo runtime smoke test instead.
  transformIgnorePatterns: ['/node_modules/(?!@autodeck)'],
};
