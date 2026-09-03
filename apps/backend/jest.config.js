/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'CommonJS', moduleResolution: 'Node', experimentalDecorators: true, emitDecoratorMetadata: true } }],
  },
  testRegex: '.*\\.spec\\.ts$',
  // Phase 2E: BookingsModule imports @autodeck/domain (computePriceSnapshot,
  // calculateCancellationRefund, isValidBookingTransition) as a genuine
  // runtime workspace dependency for the first time — its `main`/`types`
  // point straight at un-transpiled TypeScript source. Jest's default
  // transformIgnorePatterns skips all of node_modules, which would leave
  // that source untransformed; this narrowly re-includes only
  // @autodeck/domain, not node_modules generally.
  transformIgnorePatterns: ['/node_modules/(?!@autodeck/domain)'],
};
