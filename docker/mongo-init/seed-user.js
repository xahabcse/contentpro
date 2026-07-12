// Seeds a ready-to-use, pre-verified demo account into the local MongoDB the
// first time the container initialises (empty data dir). Lets anyone log in and
// use the full editor immediately -- no Resend/email and no signup required.
//
//   email:    demo@contentpro.local
//   password: demo1234
//
// The password fields below are a real PBKDF2-HMAC-SHA256 hash produced with the
// exact parameters api/src/lib/password.ts verifies against (SHA-256, 100000
// iterations, 32-byte key, 16-byte salt, base64) so login succeeds unchanged.
const target = db.getSiblingDB('contentpro');

target.users.updateOne(
  { email: 'demo@contentpro.local' },
  {
    $setOnInsert: {
      email: 'demo@contentpro.local',
      passwordHash: '5rJlLpTc0ba5tap0dpogCKiXRvy8JsZr06ZRcXjoYpM=',
      passwordSalt: 'mQR+wsBj1BwnOuajVWaHFA==',
      passwordIterations: 100000,
      emailVerified: true,
      tokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      profile: {
        name: 'Demo User',
        handle: 'demo',
        designation: 'Trying ContentPro locally',
        companyName: 'ContentPro',
      },
    },
  },
  { upsert: true },
);

target.users.createIndex({ email: 1 }, { unique: true });
print('[seed] demo@contentpro.local ready (password: demo1234)');
