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
  transformIgnorePatterns: ['/node_modules/(?!@autodeck)'],
};
