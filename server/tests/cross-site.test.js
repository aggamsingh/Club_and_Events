import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

// Split-origin deployment mode. Must be set before the app's config is first read,
// hence the dynamic import below (each test file runs in its own process).
process.env.CLIENT_ORIGIN = 'https://eventhub.example';
const { createUser, request, startTestServer, stopTestServer } = await import('./helpers.js');

let app;
before(async () => {
  app = await startTestServer();
});
after(stopTestServer);

describe('split-origin mode (CLIENT_ORIGIN set)', () => {
  it('allows credentialed CORS only for the configured origin', async () => {
    const ok = await request(app).get('/api/health').set('Origin', 'https://eventhub.example');
    assert.equal(ok.headers['access-control-allow-origin'], 'https://eventhub.example');
    assert.equal(ok.headers['access-control-allow-credentials'], 'true');

    const evil = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    assert.equal(evil.headers['access-control-allow-origin'], undefined);
  });

  it('issues SameSite=None; Secure cookies', async () => {
    const user = await createUser('student');
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'EventHub')
      .send({ email: user.email, password: 'password123' });
    assert.equal(res.status, 200);
    assert.match(res.headers['set-cookie'][0], /SameSite=None/);
    assert.match(res.headers['set-cookie'][0], /Secure/);
  });

  it('rejects state-changing requests without X-Requested-With (blocks cross-site form CSRF)', async () => {
    const res = await request(app).post('/api/auth/logout');
    assert.equal(res.status, 403);
    const withHeader = await request(app).post('/api/auth/logout').set('X-Requested-With', 'EventHub');
    assert.equal(withHeader.status, 204);
  });
});
