/**
 * Creates (or updates) the admin account from ADMIN_EMAIL / ADMIN_PASSWORD.
 * With --demo, also adds sample clubs, students, events and RSVPs so the UI has
 * something to show. Safe to re-run: existing accounts are reused, not duplicated.
 *
 *   npm run seed          # admin only
 *   npm run seed:demo     # admin + demo data
 */
import { getConfig } from '../src/config.js';
import { connectDb, disconnectDb } from '../src/db.js';
import { Event } from '../src/models/Event.js';
import { Rsvp } from '../src/models/Rsvp.js';
import { User } from '../src/models/User.js';

const DEMO_PASSWORD = 'demo-password';
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

async function upsertUser({ email, name, role, description = '', password }) {
  let user = await User.findOne({ email });
  if (!user) {
    user = new User({ email, name, role, description });
    await user.setPassword(password);
    await user.save();
    console.log(`  + ${role.padEnd(7)} ${email}`);
  }
  return user;
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 8) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (min 8 chars) in server/.env before seeding.');
  }
  let admin = await User.findOne({ email }).select('+passwordHash');
  if (admin && admin.role !== 'admin') throw new Error(`${email} exists but is not an admin.`);
  if (!admin) admin = new User({ email, name: process.env.ADMIN_NAME || 'EventHub Admin', role: 'admin' });
  await admin.setPassword(password); // re-running the seed resets the admin password
  await admin.save();
  console.log(`  ✓ admin   ${email}`);
}

async function seedDemo() {
  const clubs = await Promise.all(
    [
      ['Coding Club', 'coding@demo.eventhub', 'Hackathons, workshops and late-night debugging sessions.'],
      ['Music Society', 'music@demo.eventhub', 'Open mics, jam sessions and the annual spring concert.'],
      ['Sports Council', 'sports@demo.eventhub', 'Inter-department tournaments and fitness drives.'],
      ['Entrepreneurship Cell', 'ecell@demo.eventhub', 'Founder talks, pitch nights and startup mentoring.'],
    ].map(([name, email, description]) => upsertUser({ name, email, description, role: 'club', password: DEMO_PASSWORD })),
  );
  const students = await Promise.all(
    ['Asha Rao', 'Rahul Mehta', 'Priya Nair', 'Kabir Singh', 'Meera Iyer'].map((name, i) =>
      upsertUser({ name, email: `student${i + 1}@demo.eventhub`, role: 'student', password: DEMO_PASSWORD }),
    ),
  );

  const [coding, music, sports, ecell] = clubs;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const at = (days, hour) => new Date(today.getTime() + days * DAY + hour * HOUR);

  const demoEvents = [
    { club: coding, title: '24-Hour Hackathon', category: 'technical', venue: 'Tech Park, Hall A', startDate: at(3, 9), endDate: at(4, 9), capacity: 120, description: 'Form a team of up to four and build anything in 24 hours. Food, mentors and prizes provided.' },
    { club: coding, title: 'Intro to Git & GitHub', category: 'workshop', venue: 'Lab 402', startDate: at(1, 16), endDate: at(1, 18), capacity: 40, description: 'Hands-on session: commits, branches, pull requests. Bring a laptop.' },
    { club: music, title: 'Open Mic Night', category: 'cultural', venue: 'Amphitheatre', startDate: at(5, 18), endDate: at(5, 21), description: 'Sing, play, recite — everyone gets five minutes on stage.' },
    { club: music, title: 'Spring Concert Auditions', category: 'cultural', venue: 'Music Room', startDate: at(9, 14), endDate: at(9, 17), capacity: 30, registerLink: 'https://example.com/auditions', description: 'Auditions for vocals, guitar, keys and percussion.' },
    { club: sports, title: 'Inter-Department Football Finals', category: 'sports', venue: 'Main Ground', startDate: at(2, 15), endDate: at(2, 18), description: 'CSE vs ECE — come cheer for your department!' },
    { club: sports, title: 'Campus 5K Fun Run', category: 'sports', venue: 'Main Gate', startDate: at(12, 6), endDate: at(12, 8), capacity: 200, description: 'A relaxed 5K around campus. T-shirts for the first 100 finishers.' },
    { club: ecell, title: 'Founder Fireside Chat', category: 'seminar', venue: 'Auditorium', startDate: at(6, 17), endDate: at(6, 19), capacity: 250, description: 'An evening with alumni founders on building products students love.' },
    { club: ecell, title: 'Pitch Night', category: 'social', venue: 'Innovation Hub', startDate: at(15, 18), endDate: at(15, 21), capacity: 60, description: 'Pitch your idea in 3 minutes to a panel of mentors.' },
    { club: coding, title: 'Web Dev Bootcamp (Recap)', category: 'workshop', venue: 'Lab 401', startDate: at(-10, 10), endDate: at(-10, 16), description: 'Recap of last semester’s bootcamp.' },
    { club: music, title: 'Freshers’ Welcome Jam', category: 'social', venue: 'Student Centre', startDate: at(-20, 18), endDate: at(-20, 22), description: 'Welcome night for the new batch.' },
  ];

  let created = 0;
  for (const data of demoEvents) {
    const existing = await Event.findOne({ club: data.club._id, title: data.title });
    if (existing) continue;
    const event = await Event.create({ ...data, club: data.club._id });
    created += 1;
    // A few RSVPs so dashboards have numbers in them.
    const attendees = students.slice(0, (created % students.length) + 1);
    if (event.endDate > new Date()) {
      await Rsvp.insertMany(attendees.map((s) => ({ event: event._id, user: s._id })));
      await Event.updateOne({ _id: event._id }, { $set: { rsvpCount: attendees.length } });
    }
  }
  console.log(`  + ${created} demo events`);
  console.log(`\n  Demo accounts use the password "${DEMO_PASSWORD}"`);
  console.log('  e.g. club: coding@demo.eventhub   student: student1@demo.eventhub');
}

async function main() {
  const { mongoUri } = getConfig();
  if (!mongoUri) throw new Error('MONGO_URI is required.');
  await connectDb(mongoUri);
  console.log('Seeding…');
  await seedAdmin();
  if (process.argv.includes('--demo')) await seedDemo();
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(disconnectDb);
