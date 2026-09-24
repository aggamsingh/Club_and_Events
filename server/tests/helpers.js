process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

const { MongoMemoryServer } = await import('mongodb-memory-server');
const { default: mongoose } = await import('mongoose');
const { default: request } = await import('supertest');
const { createApp } = await import('../src/app.js');
const { connectDb, disconnectDb } = await import('../src/db.js');
const { User } = await import('../src/models/User.js');

export { request };

// A real 1×1 PNG, and a text file pretending to be one.
export const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
export const FAKE_PNG = Buffer.from('<script>alert("not an image")</script>');

let mongod;

export async function startTestServer() {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri());
  return createApp();
}

export async function stopTestServer() {
  await disconnectDb();
  await mongod?.stop();
}

export async function resetDb() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

let counter = 0;
export async function createUser(role, overrides = {}) {
  counter += 1;
  const user = new User({
    role,
    name: overrides.name ?? `${role} ${counter}`,
    email: overrides.email ?? `${role}${counter}@test.dev`,
    description: overrides.description ?? '',
  });
  await user.setPassword(overrides.password ?? 'password123');
  await user.save();
  return user;
}

/** Returns a supertest agent that carries the user's session cookie. */
export async function loginAs(app, user, password = 'password123') {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email: user.email, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

export async function createUserAndLogin(app, role, overrides) {
  const user = await createUser(role, overrides);
  return { user, agent: await loginAs(app, user, overrides?.password) };
}

const HOUR = 3600 * 1000;
export function eventFields(overrides = {}) {
  const start = overrides.start ?? new Date(Date.now() + 24 * HOUR);
  const end = overrides.end ?? new Date(start.getTime() + 2 * HOUR);
  return {
    title: 'Hack Night',
    description: 'Build something fun.',
    category: 'technical',
    venue: 'Tech Park, Room 101',
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    registerLink: '',
    capacity: '',
    ...Object.fromEntries(Object.entries(overrides).filter(([k]) => !['start', 'end'].includes(k))),
  };
}

/** Sends event fields as multipart/form-data (like the browser does), with an optional poster. */
export function sendEventForm(req, fields, poster) {
  for (const [key, value] of Object.entries(fields)) req.field(key, String(value ?? ''));
  if (poster) req.attach('poster', poster.buffer, { filename: poster.filename, contentType: poster.contentType });
  return req;
}

export async function createEventAs(agent, overrides, poster) {
  const res = await sendEventForm(agent.post('/api/events'), eventFields(overrides), poster);
  if (res.status !== 201) throw new Error(`create event failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.event;
}

export { HOUR };
