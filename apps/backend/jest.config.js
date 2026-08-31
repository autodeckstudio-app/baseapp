/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'CommonJS', moduleResolution: 'Node', experimentalDecorators: true, emitDecoratorMetadata: true } }],
  },
  testRegex: '.*\\.spec\\.ts$',
};
