import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createUser, loginAs, request, resetDb, startTestServer, stopTestServer } from './helpers.js';

let app;
before(async () => {
  app = await startTestServer();
});
after(stopTestServer);
beforeEach(resetDb);

describe('auth', () => {
  it('registers a student, sets an httpOnly session cookie and returns the profile', async () => {
    const agent = request.agent(app);
    const res = await agent
      .post('/api/auth/register')
      .send({ name: 'Asha', email: 'ASHA@Example.com', password: 'password123' });

    assert.equal(res.status, 201);
    assert.equal(res.body.user.email, 'asha@example.com');
    assert.equal(res.body.user.role, 'student');
    assert.equal(res.body.user.passwordHash, undefined);
    const cookie = res.headers['set-cookie'][0];
    assert.match(cookie, /eh_session=/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);

    const me = await agent.get('/api/auth/me');
    assert.equal(me.body.user.name, 'Asha');
  });

  it('ignores a role smuggled into the registration body (no privilege escalation)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Mallory', email: 'm@example.com', password: 'password123', role: 'admin' });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, 'student');
  });

  it('rejects duplicate emails and weak passwords with field errors', async () => {
    await createUser('student', { email: 'taken@example.com' });
    const dup = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Bob', email: 'taken@example.com', password: 'password123' });
    assert.equal(dup.status, 409);
    assert.ok(dup.body.error.fields.email);

    const weak = await request(app).post('/api/auth/register').send({ name: 'Bob', email: 'b@example.com', password: 'short' });
    assert.equal(weak.status, 400);
    assert.ok(weak.body.error.fields.password);
  });

  it('gives the same error for unknown email and wrong password', async () => {
    const user = await createUser('club');
    const wrongPw = await request(app).post('/api/auth/login').send({ email: user.email, password: 'nope-nope' });
    const noUser = await request(app).post('/api/auth/login').send({ email: 'ghost@example.com', password: 'nope-nope' });
    assert.equal(wrongPw.status, 401);
    assert.equal(noUser.status, 401);
    assert.equal(wrongPw.body.error.message, noUser.body.error.message);
  });

  it('logs out by clearing the cookie', async () => {
    const agent = await loginAs(app, await createUser('student'));
    await agent.post('/api/auth/logout').expect(204);
    const me = await agent.get('/api/auth/me');
    assert.equal(me.body.user, null);
  });

  it('rejects forged tokens', async () => {
    const res = await request(app).get('/api/me/rsvps').set('Cookie', 'eh_session=not.a.jwt');
    assert.equal(res.status, 401);
  });

  it('changing the password revokes other sessions but keeps the current one', async () => {
    const user = await createUser('student');
    const laptop = await loginAs(app, user);
    const phone = await loginAs(app, user);

    const wrong = await laptop.patch('/api/auth/password').send({ currentPassword: 'bad', newPassword: 'new-password-1' });
    assert.equal(wrong.status, 400);

    await laptop.patch('/api/auth/password').send({ currentPassword: 'password123', newPassword: 'new-password-1' }).expect(200);

    assert.ok((await laptop.get('/api/auth/me')).body.user, 'current session survives');
    assert.equal((await phone.get('/api/auth/me')).body.user, null, 'other session is revoked');
    await loginAs(app, user, 'new-password-1');
  });

  it('returns JSON errors for malformed JSON and unknown routes', async () => {
    const bad = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error.message, 'Malformed JSON body.');

    const missing = await request(app).get('/api/nope');
    assert.equal(missing.status, 404);
    assert.ok(missing.body.error.message);
  });

  it('reports health and sets security headers', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.db, 'connected');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-powered-by'], undefined);
    assert.ok(res.headers['content-security-policy']);
  });
});
