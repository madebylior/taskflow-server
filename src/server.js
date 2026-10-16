import 'dotenv/config';
import { sequelize } from './config/database.js';
import './models/index.js';
import { app } from './app.js';

const port = Number(process.env.PORT || 8000);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
  console.error('PORT must be a valid TCP port (1–65535)');
  process.exit(1);
}
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith('replace_with_')) {
  console.error('JWT_SECRET must be set to a random secret at least 32 characters long in .env');
  process.exit(1);
}
try {
  await sequelize.authenticate();
  // Suitable for this local student project; use migrations for production deployments.
  await sequelize.sync();
  const server = app.listen(port, '127.0.0.1', () => console.log(`TaskFlow running at http://127.0.0.1:${port}`));
  server.on('error', async (error) => {
    console.error('HTTP server failed:', error.message);
    process.exitCode = 1;
    await sequelize.close();
  });
  // Close the HTTP listener and SQLite connection before stopping/restarting.
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => server.close(async () => {
      await sequelize.close();
    }));
  }
} catch (error) {
  console.error('Server startup failed:', error);
  process.exitCode = 1;
  await sequelize.close();
}
