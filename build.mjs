// Kør:  node build.mjs
// Læser secret/spil.json (uploades IKKE til GitHub) og skriver gamedata.js
// med bynavne, hash af svarene og en krypteret koordinat.
import { readFileSync, writeFileSync } from 'node:fs';
import { pbkdf2Sync, randomBytes, createCipheriv } from 'node:crypto';

const ITER = 150000;
const spil = JSON.parse(readFileSync(new URL('./secret/spil.json', import.meta.url), 'utf8'));
const salt = randomBytes(16);
const b64 = (b) => Buffer.from(b).toString('base64');

const groups = spil.groups.map((g, i) => ({
  towns: g.towns,
  check: b64(pbkdf2Sync(`${i}:${g.answer}`, salt, ITER, 32, 'sha256')),
}));

// Nøglen er alle kommune-id'er i sorteret rækkefølge, så rækkefølgen af svar er ligegyldig.
const key = pbkdf2Sync(spil.groups.map((g) => g.answer).sort().join('|'), salt, ITER, 32, 'sha256');
const iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', key, iv);
const enc = Buffer.concat([cipher.update(spil.finalCoordinate, 'utf8'), cipher.final(), cipher.getAuthTag()]);

const out = `// Genereret af build.mjs – rediger secret/spil.json og kør "node build.mjs" igen.
export const iterations = ${ITER};
export const salt = '${b64(salt)}';
export const groups = ${JSON.stringify(groups, null, 2)};
export const vault = { iv: '${b64(iv)}', data: '${b64(enc)}' };
`;
writeFileSync(new URL('./gamedata.js', import.meta.url), out);
console.log('gamedata.js skrevet');
