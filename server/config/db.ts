import mongoose from 'mongoose';
import { env } from './env';

let connectionMode: 'atlas' | 'memory' | 'unconfigured' = env.mongodbUri ? 'atlas' : 'unconfigured';
let devMemoryServer: { getUri: () => string; stop: () => Promise<boolean | void> } | null = null;

export function getDatabaseMode() {
  if (mongoose.connection.readyState === 1) {
    return connectionMode === 'memory' ? 'memory' : 'atlas';
  }
  return connectionMode;
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function connectDatabase(overrideUri?: string): Promise<void> {
  if (mongoose.connection.readyState === 1) return;

  if (env.isProd && !env.jwtSecret) {
    throw new Error('FATAL: JWT_SECRET is mandatory in production.');
  }

  let uri = overrideUri || env.mongodbUri;
  let usingMemory = false;

  if (!uri) {
    if (env.isProd) {
      connectionMode = 'unconfigured';
      throw new Error(
        'MONGODB_URI (MongoDB Atlas) is not configured. Set MONGODB_URI in your environment to connect to MongoDB Atlas.'
      );
    }
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const mem = await MongoMemoryServer.create();
    devMemoryServer = mem;
    uri = mem.getUri();
    usingMemory = true;
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 10000,
  });
  connectionMode = usingMemory ? 'memory' : 'atlas';

  console.log(usingMemory ? '[DB] Connected to local development MongoDB' : '[DB] Connected to MongoDB Atlas');
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (devMemoryServer) {
    await devMemoryServer.stop();
    devMemoryServer = null;
  }
  connectionMode = env.mongodbUri ? 'atlas' : 'unconfigured';
}
