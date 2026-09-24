import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  FAKE_PNG,
  HOUR,
  PNG_1PX,
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

const png = { buffer: PNG_1PX, filename: 'poster.png', contentType: 'image/png' };

describe('creating events', () => {
  it('lets a club create an event with a poster that is then served from GridFS', async () => {
    const { user: club, agent } = await createUserAndLogin(app, 'club', { name: 'Coding Club' });
    const event = await createEventAs(agent, { capacity: '50' }, png);

    assert.equal(event.club.id, club.id);
    assert.equal(event.club.name, 'Coding Club');
    assert.equal(event.capacity, 50);
    assert.equal(event.status, 'upcoming');
    assert.match(event.posterUrl, /^\/api\/posters\/[a-f\d]{24}$/);

    const img = await request(app).get(event.posterUrl);
    assert.equal(img.status, 200);
    assert.equal(img.headers['content-type'], 'image/png');
    assert.match(img.headers['cache-control'], /immutable/);
    assert.deepEqual(Buffer.from(img.body), PNG_1PX);
  });

  it('allows events without a poster', async () => {
    const { agent } = await createUserAndLogin(app, 'club');
    const event = await createEventAs(agent);
    assert.equal(event.posterUrl, null);
  });

  it('rejects anonymous users (401) and students (403)', async () => {
    const anon = await sendEventForm(request(app).post('/api/events'), eventFields());
    assert.equal(anon.status, 401);

    const { agent } = await createUserAndLogin(app, 'student');
    const student = await sendEventForm(agent.post('/api/events'), eventFields());
    assert.equal(student.status, 403);
  });

  it('validates fields: end after start, http(s)-only links, sane capacity', async () => {
    const { agent } = await createUserAndLogin(app, 'club');
    const start = new Date(Date.now() + 5 * HOUR);

    const backwards = await sendEventForm(agent.post('/api/events'), eventFields({ start, end: new Date(start - HOUR) }));
    assert.equal(backwards.status, 400);
    assert.ok(backwards.body.error.fields.endDate);

    const xssLink = await sendEventForm(agent.post('/api/events'), eventFields({ registerLink: 'javascript:alert(1)' }));
    assert.equal(xssLink.status, 400);
    assert.ok(xssLink.body.error.fields.registerLink);

    const badCapacity = await sendEventForm(agent.post('/api/events'), eventFields({ capacity: '0' }));
    assert.equal(badCapacity.status, 400);
  });

  it('rejects files that are not really images, whatever their extension or mimetype', async () => {
    const { agent } = await createUserAndLogin(app, 'club');
    const disguised = await sendEventForm(agent.post('/api/events'), eventFields(), {
      buffer: FAKE_PNG,
      filename: 'evil.png',
      contentType: 'image/png',
    });
    assert.equal(disguised.status, 400);
    assert.ok(disguised.body.error.fields.poster);

    const pdf = await sendEventForm(agent.post('/api/events'), eventFields(), {
      buffer: FAKE_PNG,
      filename: 'doc.pdf',
      contentType: 'application/pdf',
    });
    assert.equal(pdf.status, 400);
  });

  it('rejects posters over 5 MB with 413', async () => {
    const { agent } = await createUserAndLogin(app, 'club');
    const big = Buffer.concat([PNG_1PX, Buffer.alloc(5 * 1024 * 1024)]);
    const res = await sendEventForm(agent.post('/api/events'), eventFields(), { ...png, buffer: big });
    assert.equal(res.status, 413);
  });
});

describe('editing and deleting (ownership)', () => {
  it('REGRESSION v1: a club cannot edit or delete another club’s event', async () => {
    const { agent: owner } = await createUserAndLogin(app, 'club');
    const { agent: rival } = await createUserAndLogin(app, 'club');
    const event = await createEventAs(owner);

    const edit = await sendEventForm(rival.put(`/api/events/${event.id}`), eventFields({ title: 'Hijacked' }));
    assert.equal(edit.status, 403);
    const del = await rival.delete(`/api/events/${event.id}`);
    assert.equal(del.status, 403);

    const still = await request(app).get(`/api/events/${event.id}`);
    assert.equal(still.body.event.title, 'Hack Night');
  });

  it('lets the owner edit, replace the poster (old file removed) and delete', async () => {
    const { agent } = await createUserAndLogin(app, 'club');
    const event = await createEventAs(agent, {}, png);

    const res = await sendEventForm(agent.put(`/api/events/${event.id}`), eventFields({ title: 'Hack Night 2.0' }), png);
    assert.equal(res.status, 200);
    assert.equal(res.body.event.title, 'Hack Night 2.0');
    assert.notEqual(res.body.event.posterUrl, event.posterUrl);
    assert.equal((await request(app).get(event.posterUrl)).status, 404, 'old poster deleted');

    const removed = await sendEventForm(agent.put(`/api/events/${event.id}`), eventFields({ removePoster: 'true' }));
    assert.equal(removed.body.event.posterUrl, null);
    assert.equal((await request(app).get(res.body.event.posterUrl)).status, 404);

    await agent.delete(`/api/events/${event.id}`).expect(204);
    assert.equal((await request(app).get(`/api/events/${event.id}`)).status, 404);
  });

  it('lets an admin moderate any event', async () => {
    const { agent: club } = await createUserAndLogin(app, 'club');
    const { agent: admin } = await createUserAndLogin(app, 'admin');
    const event = await createEventAs(club);

    const detail = await admin.get(`/api/events/${event.id}`);
    assert.equal(detail.body.viewer.canManage, true);
    await admin.delete(`/api/events/${event.id}`).expect(204);
  });

  it('returns 400 for malformed ids and 404 for unknown ones', async () => {
    assert.equal((await request(app).get('/api/events/not-an-id')).status, 400);
    assert.equal((await request(app).get('/api/events/0123456789abcdef01234567')).status, 404);
  });
});

describe('public feed', () => {
  async function seedFeed() {
    const { user: club, agent } = await createUserAndLogin(app, 'club');
    const now = Date.now();
    await createEventAs(agent, { title: 'Past Party', category: 'social', start: new Date(now - 48 * HOUR), end: new Date(now - 46 * HOUR) });
    await createEventAs(agent, { title: 'Live Lecture', category: 'seminar', start: new Date(now - HOUR), end: new Date(now + HOUR) });
    await createEventAs(agent, { title: 'Robotics Workshop', category: 'workshop', start: new Date(now + 48 * HOUR) });
    await createEventAs(agent, { title: 'Football Finals', category: 'sports', venue: 'Main Ground', start: new Date(now + 24 * HOUR) });
    return club;
  }

  it('shows upcoming (incl. ongoing) events soonest first by default', async () => {
    await seedFeed();
    const res = await request(app).get('/api/events');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.items.map((e) => e.title), ['Live Lecture', 'Football Finals', 'Robotics Workshop']);
    assert.equal(res.body.items[0].status, 'live');
  });

  it('shows past events most recent first', async () => {
    await seedFeed();
    const res = await request(app).get('/api/events?when=past');
    assert.deepEqual(res.body.items.map((e) => e.title), ['Past Party']);
  });

  it('filters by category, club and case-insensitive partial search', async () => {
    const club = await seedFeed();
    assert.deepEqual((await request(app).get('/api/events?category=sports')).body.items.map((e) => e.title), ['Football Finals']);
    assert.deepEqual((await request(app).get('/api/events?q=ROBO')).body.items.map((e) => e.title), ['Robotics Workshop']);
    assert.deepEqual((await request(app).get('/api/events?q=main ground')).body.items.map((e) => e.title), ['Football Finals']);
    assert.equal((await request(app).get(`/api/events?club=${club.id}&when=all`)).body.total, 4);
  });

  it('treats regex characters in search as plain text', async () => {
    await seedFeed();
    const res = await request(app).get('/api/events?q=(.*');
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 0);
  });

  it('paginates', async () => {
    await seedFeed();
    const res = await request(app).get('/api/events?when=all&limit=3&page=2');
    assert.equal(res.body.total, 4);
    assert.equal(res.body.totalPages, 2);
    assert.equal(res.body.items.length, 1);
    assert.equal((await request(app).get('/api/events?limit=500')).status, 400);
  });
});

describe('exports', () => {
  it('produces a valid iCalendar file', async () => {
    const { agent } = await createUserAndLogin(app, 'club', { name: 'Music, Arts; & More' });
    const event = await createEventAs(agent, { title: 'Open Mic, Night' });
    const res = await request(app).get(`/api/events/${event.id}/calendar.ics`);
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/calendar/);
    assert.match(res.headers['content-disposition'], /open-mic-night\.ics/);
    const body = res.text;
    assert.match(body, /^BEGIN:VCALENDAR\r\n/);
    assert.match(body, /SUMMARY:Open Mic\\, Night\r\n/);
    assert.match(body, /DTSTART:\d{8}T\d{6}Z\r\n/);
  });
});
