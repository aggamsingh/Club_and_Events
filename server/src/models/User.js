import bcrypt from 'bcrypt';
import mongoose from 'mongoose';

export const ROLES = ['admin', 'club', 'student'];
// 12 rounds ≈ 250 ms per hash on a modern CPU; tests use the minimum to stay fast.
const BCRYPT_ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 12;

// Compared against when an email does not exist, so a failed login takes the same
// time whether or not the account exists (prevents user enumeration by timing).
const DUMMY_HASH = bcrypt.hashSync('timing-attack-padding', BCRYPT_ROUNDS);

/**
 * One collection for every account. Clubs are users with role "club"; they own events.
 * `name` is the display name (student name or club name).
 */
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: 'student' },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    // Bumped on password change/reset; tokens carrying an older version are rejected.
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Club names are unique (case-insensitively); student names are not.
userSchema.index(
  { name: 1 },
  {
    unique: true,
    partialFilterExpression: { role: 'club' },
    collation: { locale: 'en', strength: 2 },
    name: 'unique_club_name',
  },
);

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, BCRYPT_ROUNDS);
};

userSchema.methods.checkPassword = function checkPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.statics.findByCredentials = async function findByCredentials(email, password) {
  const user = await this.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    return null;
  }
  return (await user.checkPassword(password)) ? user : null;
};

export const User = mongoose.model('User', userSchema);
