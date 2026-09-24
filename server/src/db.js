import mongoose from 'mongoose';

mongoose.set('strictQuery', true);

export async function connectDb(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  // Build indexes up front so unique constraints are enforced before the first request.
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}

export function isDbReady() {
  return mongoose.connection.readyState === 1;
}
