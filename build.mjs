import { createRequire } from "node:module";
const require = createRequire("/tmp/replay28/apps/admin/");
const esbuild = require("esbuild");
const stub = (name) => ({
  name,
  setup(b) {
    b.onResolve({ filter: /lib\/auth-context$/ }, () => ({ path: "/tmp/replay28/apps/admin/pixel-harness/auth-context-stub.ts" }));
  },
});
await esbuild.build({
  entryPoints: ["entry.tsx"],
  bundle: true,
  outfile: "bundle.js",
  jsx: "automatic",
  logLevel: "info",
  alias: {
    "firebase/app": "/tmp/replay28/apps/admin/pixel-harness/app-stub.ts",
    "firebase/auth": "/tmp/replay28/apps/admin/pixel-harness/auth-stub.ts",
    "firebase/firestore": "/tmp/replay28/apps/admin/pixel-harness/firestore-stub.ts",
    "firebase/functions": "/tmp/replay28/apps/admin/pixel-harness/functions-stub.ts",
    "firebase/storage": "/tmp/replay28/apps/admin/pixel-harness/storage-stub.ts",
    "firebase/app-check": "/tmp/replay28/apps/admin/pixel-harness/app-check-stub.ts",
  },
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [stub("auth-context")],
});
