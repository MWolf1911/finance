#!/usr/bin/env node

const net = require('net');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');

const rootDir = __dirname;
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const args = new Set(process.argv.slice(2));
const mode = args.has('--prod') ? 'prod' : 'dev';
const host = process.env.FINANCE_HOST || '0.0.0.0';
const backendPort = Number(process.env.PORT || process.env.FINANCE_BACKEND_PORT || 3001);
const frontendPort = Number(process.env.FINANCE_FRONTEND_PORT || 3000);

const servicesByMode = {
  dev: [
    {
      name: 'Backend',
      port: backendPort,
      cwd: path.join(rootDir, 'backend'),
      command: process.execPath,
      args: ['src/server.js'],
    },
    {
      name: 'Frontend',
      port: frontendPort,
      cwd: path.join(rootDir, 'frontend'),
      command: npmCommand,
      args: ['run', 'dev'],
    },
  ],
  prod: [
    {
      name: 'Backend',
      port: backendPort,
      cwd: path.join(rootDir, 'backend'),
      command: process.execPath,
      args: ['src/server.js'],
    },
    {
      name: 'Frontend',
      port: frontendPort,
      cwd: path.join(rootDir, 'frontend'),
      command: npmCommand,
      args: ['run', 'start', '--', '--hostname', host, '--port', String(frontendPort)],
    },
  ],
};

const services = servicesByMode[mode];

const startedChildren = [];
let shuttingDown = false;

function getLanIp() {
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal) {
        return address.address;
      }
    }
  }

  return null;
}

function canConnect(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });

    const finish = (result) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(400, () => finish(false));
  });
}

async function waitForPort(port, attempts = 20, delayMs = 250) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await canConnect(port)) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return false;
}

function pipeLines(stream, label, method = 'log') {
  const reader = readline.createInterface({ input: stream });
  reader.on('line', (line) => {
    if (!line.trim()) {
      return;
    }

    console[method](`[${label}] ${line}`);
  });
}

function printUrls() {
  const lanIp = getLanIp();

  console.log('');
  console.log(`Finance Tracker URLs (${mode}):`);
  console.log(`  Local backend:   http://localhost:${backendPort}`);
  console.log(`  Local frontend:  http://localhost:${frontendPort}`);
  if (lanIp) {
    console.log(`  LAN backend:     http://${lanIp}:${backendPort}`);
    console.log(`  LAN frontend:    http://${lanIp}:${frontendPort}`);
  }
  console.log('');
}

function spawnService(service) {
  return new Promise((resolve, reject) => {
    const child = spawn(service.command, service.args, {
      cwd: service.cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let settled = false;

    pipeLines(child.stdout, service.name, 'log');
    pipeLines(child.stderr, service.name, 'error');

    child.once('spawn', () => {
      settled = true;
      resolve(child);
    });

    child.once('error', (error) => {
      if (!settled) {
        settled = true;
        reject(error);
        return;
      }

      console.error(`[${service.name}] ${error.message}`);
      shutdown(1);
    });

    child.on('exit', (code, signal) => {
      if (shuttingDown) {
        return;
      }

      const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
      console.error(`[${service.name}] exited unexpectedly with ${reason}.`);
      shutdown(code && code !== 0 ? code : 1);
    });
  });
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of startedChildren) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  setTimeout(() => {
    for (const child of startedChildren) {
      if (!child.killed) {
        child.kill('SIGKILL');
      }
    }
    process.exit(exitCode);
  }, 250);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('uncaughtException', (error) => {
  console.error(error);
  shutdown(1);
});
process.on('unhandledRejection', (error) => {
  console.error(error);
  shutdown(1);
});

async function main() {
  console.log(`Starting Finance Tracker (${mode})...`);
  console.log('');

  const backendRunning = await canConnect(backendPort);
  if (backendRunning) {
    console.log(`Backend already running on port ${backendPort}. Skipping launch.`);
  } else {
    const backend = await spawnService(services[0]);
    startedChildren.push(backend);
    await waitForPort(backendPort, 20, 250);
  }

  const frontendRunning = await canConnect(frontendPort);
  if (frontendRunning) {
    console.log(`Frontend already running on port ${frontendPort}. Skipping launch.`);
  } else {
    const frontend = await spawnService(services[1]);
    startedChildren.push(frontend);
    await waitForPort(frontendPort, 20, 250);
  }

  printUrls();

  if (startedChildren.length === 0) {
    return;
  }

  await Promise.all(
    startedChildren.map(
      (child) => new Promise((resolve) => child.once('exit', resolve))
    )
  );
}

main().catch((error) => {
  console.error(error);
  shutdown(1);
});