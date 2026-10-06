import { spawn } from 'node:child_process';
import readline from 'node:readline';
import fs from 'node:fs';

const colors = {
  reset: '\x1b[0m',
  server: '\x1b[36m', // Cyan
  client: '\x1b[35m', // Magenta
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

function prefixStream(stream, prefix, color) {
  if (!stream) return;
  const rl = readline.createInterface({ input: stream });
  rl.on('line', (line) => {
    if (!line.trim()) {
      console.log('');
      return;
    }
    console.log(`${color}[${prefix}]${colors.reset} ${line}`);
  });
}

// Ensure dist/client exists so Wrangler doesn't error on missing assets dir
if (!fs.existsSync('dist/client')) {
  fs.mkdirSync('dist/client', { recursive: true });
}

console.log(`${colors.green}🚀 Starting LifeOS Fullstack Development Environment...${colors.reset}`);
console.log(`${colors.dim}Backend (Cloudflare D1 / Hono): http://localhost:8787${colors.reset}`);
console.log(`${colors.dim}Frontend (Vite / React 19):    http://localhost:5173${colors.reset}\n`);

const isWin = process.platform === 'win32';

// 1. Start Wrangler backend worker
const server = isWin
  ? spawn('cmd.exe', ['/c', 'npm', 'run', 'dev:server'], {
      stdio: ['inherit', 'pipe', 'pipe'],
    })
  : spawn('npm', ['run', 'dev:server'], {
      stdio: ['inherit', 'pipe', 'pipe'],
    });
prefixStream(server.stdout, 'Server', colors.server);
prefixStream(server.stderr, 'Server', colors.red);

// 2. Start Vite frontend
const client = isWin
  ? spawn('cmd.exe', ['/c', 'npm', 'run', 'dev:client'], {
      stdio: ['inherit', 'pipe', 'pipe'],
    })
  : spawn('npm', ['run', 'dev:client'], {
      stdio: ['inherit', 'pipe', 'pipe'],
    });
prefixStream(client.stdout, 'Client', colors.client);
prefixStream(client.stderr, 'Client', colors.red);

let shuttingDown = false;
function cleanExit() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${colors.yellow}Shutting down LifeOS dev processes...${colors.reset}`);
  if (isWin) {
    if (server.pid) {
      try {
        spawn('taskkill', ['/pid', String(server.pid), '/f', '/t']);
      } catch {}
    }
    if (client.pid) {
      try {
        spawn('taskkill', ['/pid', String(client.pid), '/f', '/t']);
      } catch {}
    }
  } else {
    server.kill('SIGTERM');
    client.kill('SIGTERM');
  }
  process.exit(0);
}

process.on('SIGINT', cleanExit);
process.on('SIGTERM', cleanExit);

server.on('close', (code) => {
  if (!shuttingDown && code !== 0 && code !== null) {
    console.error(`${colors.red}[Server] Process exited with code ${code}${colors.reset}`);
  }
});

client.on('close', (code) => {
  if (!shuttingDown && code !== 0 && code !== null) {
    console.error(`${colors.red}[Client] Process exited with code ${code}${colors.reset}`);
  }
});
