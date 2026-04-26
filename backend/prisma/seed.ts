import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaNeon(pool);
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

/**
 * Seed — USER ACCOUNTS ONLY.
 * No dummy DSAs, no fake activations.
 * DSAs are registered by TLs themselves via the "Add DSA" button.
 * Activations are logged live by TLs via the Log Activation form.
 */
async function main() {
  console.log('Seeding user accounts...');

  const pinHash = await bcrypt.hash('1234', 10);

  // ── System users ─────────────────────────────────────────────────────────
  await prisma.user.upsert({
    where: { staffId: 'ADMIN001' },
    update: {},
    create: { staffId: 'ADMIN001', pinHash, name: 'System Admin', role: 'ADMIN' },
  });

  await prisma.user.upsert({
    where: { staffId: 'HSD001' },
    update: {},
    create: { staffId: 'HSD001', pinHash, name: 'National HSD', role: 'HSD' },
  });

  await prisma.user.upsert({
    where: { staffId: 'ZBM-LUS' },
    update: {},
    create: { staffId: 'ZBM-LUS', pinHash, name: 'Lusaka ZBM', role: 'ZBM', zone: 'Lusaka' },
  });

  const aseUser = await prisma.user.upsert({
    where: { staffId: 'ASE-LUS01' },
    update: {},
    create: {
      staffId: 'ASE-LUS01',
      pinHash,
      name: 'Lusaka ASE 1',
      role: 'ASE',
      zone: 'Lusaka',
      region: 'Lusaka Central',
    },
  });

  // ── TL accounts (TL records only — no DSAs, no activations) ─────────────
  const tlUser1 = await prisma.user.upsert({
    where: { staffId: 'TL-LUS01' },
    update: {},
    create: {
      staffId: 'TL-LUS01',
      pinHash,
      name: 'Team Lead Chanda',
      role: 'TL',
      zone: 'Lusaka',
      region: 'Lusaka Central',
    },
  });

  const tlUser2 = await prisma.user.upsert({
    where: { staffId: 'TL-LUS02' },
    update: {},
    create: {
      staffId: 'TL-LUS02',
      pinHash,
      name: 'Team Lead Banda',
      role: 'TL',
      zone: 'Lusaka',
      region: 'Lusaka Central',
    },
  });

  await prisma.teamLead.upsert({
    where: { userId: tlUser1.id },
    update: {},
    create: {
      userId: tlUser1.id,
      aseId: aseUser.id,
      zone: 'Lusaka',
      region: 'Lusaka Central',
      allocatedTarget: 50,
    },
  });

  await prisma.teamLead.upsert({
    where: { userId: tlUser2.id },
    update: {},
    create: {
      userId: tlUser2.id,
      aseId: aseUser.id,
      zone: 'Lusaka',
      region: 'Lusaka Central',
      allocatedTarget: 50,
    },
  });

  console.log('✅ Seed complete — user accounts only, no dummy data.');
  console.log('  ADMIN001 / HSD001 / ZBM-LUS / ASE-LUS01 / TL-LUS01 / TL-LUS02 — PIN: 1234');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
