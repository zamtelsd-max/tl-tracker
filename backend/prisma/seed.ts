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

const DSA_NAMES_1 = [
  'Mwale Bwalya', 'Chanda Mutale', 'Phiri Nkonde', 'Tembo Mutondo',
  'Lungu Kafwimbi', 'Mumba Chisanga', 'Banda Mwanza', 'Sakala Mulenga',
  'Zulu Kapeya', 'Musonda Chilufya',
];

const DSA_NAMES_2 = [
  'Daka Mwale', 'Sinkala Bwalya', 'Mutale Phiri', 'Nkonde Tembo',
  'Kafwimbi Lungu', 'Chisanga Mumba', 'Mwanza Banda', 'Mulenga Sakala',
  'Kapeya Zulu', 'Chilufya Musonda',
];

const HOUR_SLOTS = [
  '08:00-09:00', '09:00-10:00', '10:00-11:00', '11:00-12:00',
  '12:00-13:00', '13:00-14:00', '14:00-15:00', '15:00-16:00',
  '16:00-17:00', '17:00-18:00',
];

function getPastDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

async function main() {
  console.log('Seeding database...');

  const pinHash = await bcrypt.hash('1234', 10);

  // Create users
  const adminUser = await prisma.user.upsert({
    where: { staffId: 'ADMIN001' },
    update: {},
    create: { staffId: 'ADMIN001', pinHash, name: 'System Admin', role: 'ADMIN' },
  });

  const hsdUser = await prisma.user.upsert({
    where: { staffId: 'HSD001' },
    update: {},
    create: { staffId: 'HSD001', pinHash, name: 'National HSD', role: 'HSD' },
  });

  const zbmUser = await prisma.user.upsert({
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

  // Create TeamLead records
  const tl1 = await prisma.teamLead.upsert({
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

  const tl2 = await prisma.teamLead.upsert({
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

  // Create DSAs for TL1
  const dsa1List = [];
  for (const name of DSA_NAMES_1) {
    const dsa = await prisma.dSA.upsert({
      where: { teamLeadId_name: { teamLeadId: tl1.id, name } },
      update: {},
      create: { teamLeadId: tl1.id, name, status: 'ACTIVE' },
    });
    dsa1List.push(dsa);
  }

  // Create DSAs for TL2
  const dsa2List = [];
  for (const name of DSA_NAMES_2) {
    const dsa = await prisma.dSA.upsert({
      where: { teamLeadId_name: { teamLeadId: tl2.id, name } },
      update: {},
      create: { teamLeadId: tl2.id, name, status: 'ACTIVE' },
    });
    dsa2List.push(dsa);
  }

  // Seed 3 days of activation history
  const customerNames = [
    'John Mwila', 'Mary Banda', 'Peter Chanda', 'Grace Mutale', 'James Phiri',
    'Ruth Tembo', 'Daniel Lungu', 'Esther Mumba', 'Samuel Zulu', 'Hannah Musonda',
    'Joseph Sakala', 'Naomi Mwanza', 'David Daka', 'Deborah Sinkala', 'Paul Nkonde',
  ];

  for (let day = 1; day <= 3; day++) {
    const date = getPastDate(day);

    for (const dsa of dsa1List) {
      // Each DSA logs 3-7 activations spread across hours
      const numActivations = 3 + Math.floor(Math.random() * 5);
      for (let i = 0; i < numActivations; i++) {
        const hourSlot = HOUR_SLOTS[Math.floor(Math.random() * HOUR_SLOTS.length)];
        const customerName = customerNames[Math.floor(Math.random() * customerNames.length)];
        await prisma.activation.create({
          data: {
            teamLeadId: tl1.id,
            dsaId: dsa.id,
            customerName,
            count: 1,
            hourSlot,
            date,
          },
        });
      }
    }

    for (const dsa of dsa2List) {
      const numActivations = 2 + Math.floor(Math.random() * 6);
      for (let i = 0; i < numActivations; i++) {
        const hourSlot = HOUR_SLOTS[Math.floor(Math.random() * HOUR_SLOTS.length)];
        const customerName = customerNames[Math.floor(Math.random() * customerNames.length)];
        await prisma.activation.create({
          data: {
            teamLeadId: tl2.id,
            dsaId: dsa.id,
            customerName,
            count: 1,
            hourSlot,
            date,
          },
        });
      }
    }
  }

  // Seed today's data (partial)
  const today = new Date().toISOString().split('T')[0];
  const currentHour = new Date().getHours();
  const hoursElapsed = Math.max(0, Math.min(currentHour - 8, 10));
  const todaySlots = HOUR_SLOTS.slice(0, hoursElapsed);

  for (const dsa of dsa1List) {
    for (const slot of todaySlots) {
      const count = Math.random() > 0.2 ? Math.floor(Math.random() * 3) + 1 : 0;
      if (count > 0) {
        await prisma.activation.create({
          data: {
            teamLeadId: tl1.id,
            dsaId: dsa.id,
            customerName: customerNames[Math.floor(Math.random() * customerNames.length)],
            count,
            hourSlot: slot,
            date: today,
          },
        });
      }
    }
  }

  for (const dsa of dsa2List) {
    for (const slot of todaySlots) {
      const count = Math.random() > 0.3 ? Math.floor(Math.random() * 3) + 1 : 0;
      if (count > 0) {
        await prisma.activation.create({
          data: {
            teamLeadId: tl2.id,
            dsaId: dsa.id,
            customerName: customerNames[Math.floor(Math.random() * customerNames.length)],
            count,
            hourSlot: slot,
            date: today,
          },
        });
      }
    }
  }

  console.log('✅ Seed complete!');
  console.log('Users created:');
  console.log(`  ADMIN001 (ADMIN) - PIN: 1234`);
  console.log(`  HSD001 (HSD) - PIN: 1234`);
  console.log(`  ZBM-LUS (ZBM) - PIN: 1234`);
  console.log(`  ASE-LUS01 (ASE) - PIN: 1234`);
  console.log(`  TL-LUS01 (TL - ${tl1.id}) - PIN: 1234`);
  console.log(`  TL-LUS02 (TL - ${tl2.id}) - PIN: 1234`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
