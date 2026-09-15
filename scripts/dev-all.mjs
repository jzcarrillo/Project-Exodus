import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

console.log('🚀 Starting Bureau of Immigration Backend & Frontend Services...\n');

const backend = spawn('npm', ['run', 'start:dev'], {
  cwd: path.join(root, 'backend'),
  stdio: 'inherit',
  shell: true,
});

const frontend = spawn('npm', ['run', 'dev'], {
  cwd: path.join(root, 'frontend'),
  stdio: 'inherit',
  shell: true,
});

function cleanup() {
  backend.kill();
  frontend.kill();
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
