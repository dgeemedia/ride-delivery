// backend/prisma/seed-admins.js
//
// Creates one ADMIN and one SUPER_ADMIN account.
// Run with:  node prisma/seed-admins.js
//
// ⚠️  Change the passwords before deploying to production!

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const ADMINS = [
  {
    firstName: 'Admin',
    lastName:  'Diakite',
    email:     'admin@diakite.com',
    phone:     '+2348000000001',
    password:  'Admin@123456',         // ← change before going live
    role:      'ADMIN',
  },
  {
    firstName: 'Super',
    lastName:  'Admin',
    email:     'superadmin1@diakite.com',
    phone:     '+2348000000002',
    password:  'SuperAdmin@123456',    // ← change before going live
    role:      'SUPER_ADMIN',
  },
];

async function main() {
  console.log('🌱  Seeding admin accounts...\n');

  for (const admin of ADMINS) {
    // Skip if account already exists
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: admin.email }, { phone: admin.phone }] },
    });

    if (existing) {
      console.log(`⚠️   ${admin.role} already exists → ${admin.email} (skipped)`);
      continue;
    }

    const hashedPassword = await bcrypt.hash(admin.password, 10);

    const user = await prisma.user.create({
      data: {
        email:      admin.email,
        phone:      admin.phone,
        password:   hashedPassword,
        firstName:  admin.firstName,
        lastName:   admin.lastName,
        role:       admin.role,
        isActive:   true,
        isVerified: true,  // admins skip email verification
        wallet: {
          create: {
            balance:  0,
            currency: 'NGN',
          },
        },
      },
      select: {
        id: true, email: true, phone: true,
        firstName: true, lastName: true, role: true,
      },
    });

    console.log(`✅  Created ${user.role}`);
    console.log(`    Name  : ${user.firstName} ${user.lastName}`);
    console.log(`    Email : ${user.email}`);
    console.log(`    Phone : ${user.phone}`);
    console.log(`    ID    : ${user.id}`);
    console.log('');
  }

  console.log('✔   Done.\n');
  console.log('─────────────────────────────────────────');
  console.log('  Credentials (change after first login!)');
  console.log('─────────────────────────────────────────');
  ADMINS.forEach(a => {
    console.log(`  [${a.role}]  ${a.email}  /  ${a.password}`);
  });
  console.log('');
}

main()
  .catch((err) => {
    console.error('❌  Seed failed:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });