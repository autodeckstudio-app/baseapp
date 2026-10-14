// Run all four apps together: pnpm dev:all
//   customer  http://localhost:8081   (Expo web)
//   studio    http://localhost:8082   (Expo web)
//   admin     http://localhost:3001   (Next.js)
//   site      http://localhost:4321   (Astro)
// Ctrl-C stops all of them. Output is prefixed with the app name.
import { spawn } from "node:child_process";

const apps = [
  { name: "customer", dir: "apps/customer", cmd: "npx", args: ["expo", "start", "--web", "--port", "8081"], env: { CI: "1" } },
  { name: "studio", dir: "apps/studio", cmd: "npx", args: ["expo", "start", "--web", "--port", "8082"], env: { CI: "1" } },
  { name: "admin", dir: "apps/admin", cmd: "npx", args: ["next", "dev", "-p", "3001"], env: {} },
  { name: "site", dir: "apps/site", cmd: "npx", args: ["astro", "dev", "--port", "4321"], env: {} },
];
const colours = ["\x1b[36m", "\x1b[35m", "\x1b[33m", "\x1b[32m"];
const procs = apps.map((a, i) => {
  const p = spawn(a.cmd, a.args, { cwd: a.dir, env: { ...process.env, ...a.env }, stdio: ["ignore", "pipe", "pipe"] });
  const tag = `${colours[i]}[${a.name}]\x1b[0m `;
  const pipe = (s, out) => { let buf = ""; s.on("data", (d) => { buf += d; const lines = buf.split("\n"); buf = lines.pop() ?? ""; for (const l of lines) out.write(tag + l + "\n"); }); };
  pipe(p.stdout, process.stdout); pipe(p.stderr, process.stderr);
  p.on("exit", (code) => console.log(`${tag}exited (${code})`));
  return p;
});
const stop = () => { for (const p of procs) p.kill("SIGTERM"); setTimeout(() => process.exit(0), 500); };
process.on("SIGINT", stop); process.on("SIGTERM", stop);
console.log("Starting customer :8081, studio :8082, admin :3001, site :4321. Ctrl-C to stop.");
