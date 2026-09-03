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
  // Phase 3A: admin-web's tests are all pure-logic (session-state
  // derivation, role-access rules, API client wiring) — no component
  // rendering, so no jsdom/@testing-library dependency is needed. React
  // component files (AuthProvider, pages, UI primitives) are exercised via
  // the Next.js dev/build/runtime smoke test instead, not unit-rendered
  // here. This mirrors the same transformIgnorePatterns need the backend
  // already established for `@autodeck/domain`.
  transformIgnorePatterns: ['/node_modules/(?!@autodeck)'],
};
