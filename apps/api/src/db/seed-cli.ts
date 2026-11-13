import { openDb } from './client';
import { DEMO_PASSWORD, seed } from './seed';

const h = await openDb();
const r = await seed(h.db, { force: process.argv.includes('--force') });
console.log(r.seeded ? `Seeded demo tenants (${h.driver}). Dealer logins: owner@dealer-a.example.com / owner@dealer-b.example.com, password: ${DEMO_PASSWORD}` : 'Database already has tenants — skipped (use --force on an empty DB only).');
await h.close();
