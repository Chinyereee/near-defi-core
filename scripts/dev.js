// scripts/dev.js: run the API server and the Vite dev server together.
// Cross-platform (PowerShell has no `&`), no extra dependency.
import { spawn } from 'node:child_process';

const procs = [
  spawn('node', ['--watch', 'server.js'], { stdio: 'inherit', shell: true }),
  spawn('npx', ['vite', '--config', 'web/vite.config.ts'], { stdio: 'inherit', shell: true }),
];

const stop = () => {
  for (const p of procs) p.kill();
  process.exit();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const p of procs) p.on('exit', (code) => code && stop());
