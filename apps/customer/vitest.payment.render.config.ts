import base from './vitest.render.config';
export default {...base,define:{...base.define,__DEV__:'false'},test:{...base.test,exclude:[],include:['src/**/*.render.test.tsx']}};
