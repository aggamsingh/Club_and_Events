import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  HOUR,
  createEventAs,
  createUserAndLogin,
  eventFields,
  request,
  resetDb,
  sendEventForm,
  startTestServer,
  stopTestServer,
} from './helpers.js';

let app;
before(async () => {
  app = await startTestServer();
});
after(stopTestServer);
beforeEach(resetDb);

describe('RSVPs', () => {
  it('lets a student RSVP once, shows it on the event and in "my events", and cancel', async () => {
    const { agent: club } = await createUserAndLogin(app, 'club');
    const { agent: student } = await createUserAndLogin(app, 'student');
    const event = await createEventAs(club);

    const rsvp = await student.post(`/api/events/${event.id}/rsvp`);
    assert.equal(rsvp.status, 201);
    assert.equal(rsvp.body.event.rsvpCount, 1);

    const again = await student.post(`/api/events/${event.id}/rsvp`);
    assert.equal(again.status, 409);

    const detail = await student.get(`/api/events/${event.id}`);
    assert.equal(detail.body.viewer.hasRsvp, true);
    assert.equal(detail.body.event.rsvpCount, 1);

    const mine = await student.get('/api/me/rsvps');
    assert.deepEqual(mine.body.upcoming.map((e) => e.id), [event.id]);

    await student.delete(`/api/events/${event.id}/rsvp`).expect(204);
    assert.equal((await request(app).get(`/api/events/${event.id}`)).body.event.rsvpCount, 0);
    assert.equal((await student.delete(`/api/events/${event.id}/rsvp`)).status, 404);
  });

  it('only students can RSVP', async () => {
    const { agent: club } = await createUserAndLogin(app, 'club');
    const event = await createEventAs(club);
    assert.equal((await club.post(`/api/events/${event.id}/rsvp`)).status, 403);
    assert.equal((await request(app).post(`/api/events/${event.id}/rsvp`)).status, 401);
  });

  it('never over-books: 10 simultaneous RSVPs for 3 seats → exactly 3 succeed', async () => {
    const { agent: club } = await createUserAndLogin(app, 'club');
    const event = await createEventAs(club, { capacity: '3' });
    const students = await Promise.all(Array.from({ length: 10 }, () => createUserAndLogin(app, 'student')));

    const results = await Promise.all(students.map(({ agent }) => agent.post(`/api/events/${event.id}/rsvp`)));
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [201, 201, 201, 409, 409, 409, 409, 409, 409, 409]);

    const detail = await request(app).get(`/api/events/${event.id}`);
    assert.equal(detail.body.event.rsvpCount, 3);
    assert.equal(detail.body.event.isFull, true);

    const attendees = await club.get(`/api/events/${event.id}/attendees`);
    assert.equal(attendees.body.total, 3);
  });

  it('blocks RSVPs to events that have ended', async () => {
    const { agent: club } = await createUserAndLogin(app, 'club');
    const { agent: student } = await createUserAndLogin(app, 'student');
    const event = await createEventAs(club, { start: new Date(Date.now() - 3 * HOUR), end: new Date(Date.now() - HOUR) });
    const res = await student.post(`/api/events/${event.id}/rsvp`);
    assert.equal(res.status, 409);
  });

  it('refuses to shrink capacity below existing RSVPs', async () => {
    const { agent: club } = await createUserAndLogin(app, 'club');
    const event = await createEventAs(club, { capacity: '10' });
    for (let i = 0; i < 2; i++) {
      const { agent } = await createUserAndLogin(app, 'student');
      await agent.post(`/api/events/${event.id}/rsvp`).expect(201);
    }
    const res = await sendEventForm(club.put(`/api/events/${event.id}`), eventFields({ capacity: '1' }));
    assert.equal(res.status, 400);
    assert.ok(res.body.error.fields.capacity);
  });
});

describe('attendee export', () => {
  it('is visible only to the owner, and neutralises spreadsheet formulas in CSV', async () => {
    const { agent: club } = await createUserAndLogin(app, 'club');
    const { agent: otherClub } = await createUserAndLogin(app, 'club');
    const { agent: student } = await createUserAndLogin(app, 'student', { name: '=HYPERLINK("http://evil")' });
    const event = await createEventAs(club);
    await student.post(`/api/events/${event.id}/rsvp`).expect(201);

    assert.equal((await otherClub.get(`/api/events/${event.id}/attendees`)).status, 403);
    assert.equal((await student.get(`/api/events/${event.id}/attendees`)).status, 403);

    const csv = await club.get(`/api/events/${event.id}/attendees?format=csv`);
    assert.equal(csv.status, 200);
    assert.match(csv.headers['content-type'], /text\/csv/);
    assert.match(csv.headers['content-disposition'], /attachment; filename="hack-night-attendees.csv"/);
    assert.match(csv.text, /"'=HYPERLINK\(""http:\/\/evil""\)"/);
  });
});

describe('dashboards', () => {
  it('gives clubs their own events with stats', async () => {
    const { agent: club } = await createUserAndLogin(app, 'club');
    const { agent: other } = await createUserAndLogin(app, 'club');
    const { agent: student } = await createUserAndLogin(app, 'student');
    const mine = await createEventAs(club);
    await createEventAs(club, { start: new Date(Date.now() - 5 * HOUR), end: new Date(Date.now() - 4 * HOUR) });
    await createEventAs(other);
    await student.post(`/api/events/${mine.id}/rsvp`).expect(201);

    const res = await club.get('/api/me/events');
    assert.equal(res.body.items.length, 2);
    assert.deepEqual(res.body.stats, { total: 2, upcoming: 1, totalRsvps: 1 });
  });

  it('gives admins platform stats', async () => {
    const { agent: admin } = await createUserAndLogin(app, 'admin');
    const { agent: club } = await createUserAndLogin(app, 'club');
    await createEventAs(club);
    const res = await admin.get('/api/admin/stats');
    assert.deepEqual(res.body.stats, { clubs: 1, students: 0, events: 1, upcomingEvents: 1, rsvps: 0 });
    assert.equal((await club.get('/api/admin/stats')).status, 403);
  });
});
