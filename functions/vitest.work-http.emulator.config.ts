import{mergeConfig}from'vitest/config';import base from'./vitest.emulator.config';export default mergeConfig(base,{test:{include:['src/test/emulator/work-coverage-http.work-contract.ts']}});
