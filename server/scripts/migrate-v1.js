/**
 * One-off migration from the v1 schema to v2.
 *
 * v1 stored:  clubs  { name, password (bcrypt) }
 *             events { clubName, name, startDate, endDate, venue, posterPath, registerLink }
 *             posters on the server's local disk (server/uploads/…)
 * v2 stores:  users  { name, email, passwordHash, role: 'club', … }
 *             events { title, club: ObjectId, poster: GridFS id, category, capacity, rsvpCount, … }
 *
 * v1 passwords were bcrypt hashes, so they're copied as-is and clubs keep their passwords.
 * v1 clubs had no email, so a placeholder <slug>@clubs.eventhub.local is assigned; an admin
 * should update it later. Posters found on disk are copied into GridFS.
 *
 *   node scripts/migrate-v1.js --dry-run   # report only
 *   node scripts/migrate-v1.js             # apply
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { getConfig } from '../src/config.js';
import { connectDb, disconnectDb } from '../src/db.js';
import { savePoster } from '../src/services/posterStorage.js';
import { slugify } from '../src/utils/text.js';

const dryRun = process.argv.includes('--dry-run');
const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const { mongoUri } = getConfig();
  if (!mongoUri) throw new Error('MONGO_URI is required.');
  await connectDb(mongoUri);
  const db = mongoose.connection.db;
  const users = db.collection('users');
  const events = db.collection('events');

  const v1Clubs = (await db.listCollections({ name: 'clubs' }).hasNext()) ? await db.collection('clubs').find().toArray() : [];
  const v1Events = await events.find({ clubName: { $exists: true } }).toArray();
  console.log(`Found ${v1Clubs.length} v1 clubs and ${v1Events.length} v1 events.${dryRun ? ' (dry run)' : ''}`);

  const clubIdByName = new Map();
  for (const club of v1Clubs) {
    const existing = await users.findOne({ role: 'club', name: club.name }, { collation: { locale: 'en', strength: 2 } });
    if (existing) {
      clubIdByName.set(club.name, existing._id);
      continue;
    }
    const email = `${slugify(club.name)}@clubs.eventhub.local`;
    console.log(`  club  "${club.name}" → ${email}`);
    if (dryRun) continue;
    const now = new Date();
    const { insertedId } = await users.insertOne({
      name: club.name,
      email,
      passwordHash: club.password,
      role: 'club',
      description: '',
      tokenVersion: 0,
      createdAt: now,
      updatedAt: now,
    });
    clubIdByName.set(club.name, insertedId);
  }

  for (const event of v1Events) {
    const clubId = clubIdByName.get(event.clubName);
    if (!clubId && !dryRun) {
      console.warn(`  skip  event "${event.name}": club "${event.clubName}" not found`);
      continue;
    }
    let poster = null;
    const posterFile = event.posterPath && path.resolve(serverDir, event.posterPath.replace(/\\/g, '/'));
    if (posterFile && fs.existsSync(posterFile) && !dryRun) {
      try {
        poster = await savePoster({ buffer: fs.readFileSync(posterFile), originalname: path.basename(posterFile) });
      } catch (err) {
        console.warn(`  poster for "${event.name}" not imported: ${err.message}`);
      }
    }
    console.log(`  event "${event.name}" (${event.clubName})${posterFile && fs.existsSync(posterFile) ? ' + poster' : ''}`);
    if (dryRun) continue;
    await events.updateOne(
      { _id: event._id },
      {
        $set: {
          title: event.name,
          description: '',
          category: 'other',
          club: clubId,
          poster,
          registerLink: /^https?:\/\//i.test(event.registerLink ?? '') ? event.registerLink : null,
          capacity: null,
          rsvpCount: 0,
          updatedAt: new Date(),
        },
        $unset: { clubName: '', name: '', posterPath: '' },
      },
    );
  }

  if (!dryRun && v1Clubs.length) {
    console.log('\nMigration complete. The old "clubs" collection was left in place;');
    console.log('drop it manually once you have verified the result.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(disconnectDb);
