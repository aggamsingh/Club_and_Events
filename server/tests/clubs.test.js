import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  PNG_1PX,
  createEventAs,
  createUserAndLogin,
  loginAs,
  request,
  resetDb,
  startTestServer,
  stopTestServer,
} from './helpers.js';

let app;
before(async () => {
  app = await startTestServer();
});
after(stopTestServer);
beforeEach(resetDb);

const newClub = { name: 'Robotics Society', email: 'robotics@campus.edu', password: 'password123', description: 'We build robots.' };

describe('club management', () => {
  it('only admins can create clubs (v1 allowed anyone)', async () => {
    assert.equal((await request(app).post('/api/clubs').send(newClub)).status, 401);
    const { agent: student } = await createUserAndLogin(app, 'student');
    assert.equal((await student.post('/api/clubs').send(newClub)).status, 403);

    const { agent: admin } = await createUserAndLogin(app, 'admin');
    const res = await admin.post('/api/clubs').send(newClub);
    assert.equal(res.status, 201);
    assert.equal(res.body.club.role, 'club');

    // The new club can log in with the credentials the admin set.
    await loginAs(app, { email: newClub.email }, newClub.password);
  });

  it('enforces case-insensitive unique club names', async () => {
    const { agent: admin } = await createUserAndLogin(app, 'admin');
    await admin.post('/api/clubs').send(newClub).expect(201);
    const dup = await admin.post('/api/clubs').send({ ...newClub, name: 'robotics SOCIETY', email: 'other@campus.edu' });
    assert.equal(dup.status, 409);
  });

  it('lists clubs publicly with upcoming-event counts', async () => {
    const { agent: club } = await createUserAndLogin(app, 'club', { name: 'Chess Club' });
    await createEventAs(club);
    const res = await request(app).get('/api/clubs');
    assert.equal(res.status, 200);
    assert.equal(res.body.items[0].name, 'Chess Club');
    assert.equal(res.body.items[0].upcomingCount, 1);
    assert.equal(res.body.items[0].email, undefined, 'club emails are not public');

    const { agent: admin } = await createUserAndLogin(app, 'admin');
    const asAdmin = await admin.get('/api/clubs');
    assert.match(asAdmin.body.items[0].email, /@test\.dev$/, 'admins see login emails');
  });

  it('lets a club edit its own description but not rename itself or edit others', async () => {
    const { user: club, agent } = await createUserAndLogin(app, 'club');
    const { user: other } = await createUserAndLogin(app, 'club');

    const ok = await agent.patch(`/api/clubs/${club.id}`).send({ description: 'New blurb' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.club.description, 'New blurb');

    assert.equal((await agent.patch(`/api/clubs/${club.id}`).send({ name: 'Renamed' })).status, 403);
    assert.equal((await agent.patch(`/api/clubs/${other.id}`).send({ description: 'x' })).status, 403);
  });

  it('admin password reset revokes the club’s existing sessions', async () => {
    const { user: club, agent: clubAgent } = await createUserAndLogin(app, 'club');
    const { agent: admin } = await createUserAndLogin(app, 'admin');
    await admin.post(`/api/clubs/${club.id}/reset-password`).send({ password: 'brand-new-pass' }).expect(204);
    assert.equal((await clubAgent.get('/api/auth/me')).body.user, null);
    await loginAs(app, club, 'brand-new-pass');
  });

  it('deleting a club cascades to its events, RSVPs and posters', async () => {
    const { user: club, agent: clubAgent } = await createUserAndLogin(app, 'club');
    const { agent: student } = await createUserAndLogin(app, 'student');
    const { agent: admin } = await createUserAndLogin(app, 'admin');
    const event = await createEventAs(clubAgent, {}, { buffer: PNG_1PX, filename: 'p.png', contentType: 'image/png' });
    await student.post(`/api/events/${event.id}/rsvp`).expect(201);

    await admin.delete(`/api/clubs/${club.id}`).expect(204);

    assert.equal((await request(app).get(`/api/events/${event.id}`)).status, 404);
    assert.equal((await request(app).get(event.posterUrl)).status, 404);
    assert.deepEqual((await student.get('/api/me/rsvps')).body.upcoming, []);
    assert.equal((await admin.get('/api/admin/stats')).body.stats.rsvps, 0);
  });
});
