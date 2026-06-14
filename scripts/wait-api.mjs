const url = process.argv[2] ?? 'http://localhost:3001/api/health';
const timeoutMs = Number(process.argv[3] ?? 30_000);
const pollMs = 300;
const started = Date.now();

while (Date.now() - started < timeoutMs) {
  try {
    const response = await fetch(url);
    if (response.ok) {
      console.log('[dev] API ready');
      process.exit(0);
    }
  } catch {
    // API ещё не слушает порт
  }

  await new Promise((resolve) => setTimeout(resolve, pollMs));
}

console.error(`[dev] API did not become ready within ${timeoutMs}ms (${url})`);
process.exit(1);
