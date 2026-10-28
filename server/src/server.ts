import mongoose from 'mongoose';
import { app } from './app.js';
import { config } from './config.js';
import { failInterruptedGenerations } from './store.js';

async function start() {
  if (config.MONGODB_URI?.trim()) {
    try { await mongoose.connect(config.MONGODB_URI, { dbName: config.MONGODB_DB_NAME, serverSelectionTimeoutMS: 15000 }); console.log('MongoDB connected'); }
    catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
      const codeName = typeof error === 'object' && error !== null && 'codeName' in error ? error.codeName : undefined;
      console.error(JSON.stringify({ event: 'mongodb.connect.failed', code, codeName }));
      const localUri = /^mongodb:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|\/)/i.test(config.MONGODB_URI);
      if (config.NODE_ENV !== 'development' || !localUri) throw new Error('MongoDB connection failed. Check the URI, credentials, and network access.');
      console.warn('Local MongoDB unavailable; using temporary in-memory storage. Cases will not persist.');
    }
    if (mongoose.connection.readyState === 1) await failInterruptedGenerations();
  } else {
    if (config.NODE_ENV === 'production') throw new Error('MONGODB_URI is required in production.');
    console.warn('MONGODB_URI is empty; using temporary in-memory storage. Cases will not persist.');
  }
  app.listen(config.PORT, () => console.log(`Mystery API listening on ${config.PORT}`));
}
start().catch((error: unknown) => { console.error(error); process.exit(1); });
