import { createApp } from './app.js';
import { getConfig } from './config.js';
import { connectDb, disconnectDb } from './db.js';

async function main() {
  const config = getConfig();
  if (!config.mongoUri) throw new Error('MONGO_URI is required. Copy server/.env.example to server/.env.');

  await connectDb(config.mongoUri);
  console.log('[db] connected');

  const server = createApp().listen(config.port, () => {
    console.log(`[http] EventHub API listening on http://localhost:${config.port} (${config.env})`);
  });

  // Graceful shutdown: stop accepting connections, finish in-flight requests, close the pool.
  const shutdown = (signal) => {
    console.log(`[http] ${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
