#!/usr/bin/env node

/**
 * StackX SkillTrack — Unified Application Runner
 * Starts both Backend (Express on port 4300) and Frontend (Vite on port 5173) concurrently.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.argv.includes('--prod');
const backendCmd = isProd ? ['start'] : ['run', 'dev'];
const frontendCmd = isProd ? ['run', 'preview'] : ['run', 'dev'];

console.log('\x1b[1m\x1b[35m%s\x1b[0m', '═════════════════════════════════════════════════════════════');
console.log('\x1b[1m\x1b[36m%s\x1b[0m', '   StackX SkillTrack — Unified Application Runner');
console.log('\x1b[90m%s\x1b[0m', `   Mode: ${isProd ? 'Production' : 'Development'}`);
console.log('\x1b[90m%s\x1b[0m', '   • Backend API : http://localhost:4300');
console.log('\x1b[90m%s\x1b[0m', '   • Frontend UI : http://localhost:5173');
console.log('\x1b[1m\x1b[35m%s\x1b[0m', '═════════════════════════════════════════════════════════════\n');

function spawnService(name, color, dir, args) {
  const child = spawn('npm', args, {
    cwd: path.join(__dirname, dir),
    shell: true,
    env: {
      ...process.env,
      FORCE_COLOR: '1',
      NODE_ENV: isProd ? 'production' : (process.env.NODE_ENV || 'development'),
    },
  });

  const prefix = `\x1b[1m${color}[${name}]\x1b[0m `;

  const pipeOutput = (stream) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.trim()) {
          console.log(`${prefix}${line}`);
        }
      }
    });
    stream.on('end', () => {
      if (buffer.trim()) {
        console.log(`${prefix}${buffer}`);
      }
    });
  };

  if (child.stdout) pipeOutput(child.stdout);
  if (child.stderr) pipeOutput(child.stderr);

  return child;
}

const backend = spawnService('Backend', '\x1b[36m', 'backend', backendCmd);
const frontend = spawnService('Frontend', '\x1b[32m', 'frontend', frontendCmd);

let isShuttingDown = false;

function shutdown(code = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('\n\x1b[33m🛑 Stopping StackX SkillTrack services...\x1b[0m');

  const killChild = (child) => {
    if (!child || child.killed) return;
    try {
      child.kill('SIGINT');
      setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch (_) {}
      }, 1000);
    } catch (_) {}
  };

  killChild(backend);
  killChild(frontend);

  setTimeout(() => {
    console.log('\x1b[32m✔ All services stopped.\x1b[0m\n');
    process.exit(code);
  }, 1200);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('SIGHUP', () => shutdown(0));

backend.on('close', (code) => {
  if (!isShuttingDown && code !== 0 && code !== null) {
    console.error(`\x1b[31m[Backend] Exited with code ${code}\x1b[0m`);
    shutdown(code);
  }
});

frontend.on('close', (code) => {
  if (!isShuttingDown && code !== 0 && code !== null) {
    console.error(`\x1b[31m[Frontend] Exited with code ${code}\x1b[0m`);
    shutdown(code);
  }
});

