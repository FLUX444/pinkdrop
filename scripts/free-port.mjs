import { execSync } from 'child_process';

const port = String(process.argv[2] ?? '3001');

function freePortOnWindows(targetPort) {
  try {
    const output = execSync(`netstat -ano | findstr :${targetPort}`, { encoding: 'utf8' });
    const pids = new Set();
    for (const line of output.split(/\r?\n/)) {
      if (!line.includes('LISTENING')) continue;
      const parts = line.trim().split(/\s+/);
      const pid = Number(parts.at(-1));
      if (Number.isFinite(pid) && pid > 0) pids.add(pid);
    }

    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        console.log(`[dev:server] Stopped stale process ${pid} on port ${targetPort}`);
      } catch {
        // ignore
      }
    }
  } catch {
    // port already free
  }
}

if (process.platform === 'win32') {
  freePortOnWindows(port);
}
