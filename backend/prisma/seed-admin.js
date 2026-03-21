// backend/prisma/seed-admins.js
//
// PREREQUISITE — add adminDepartment to prisma/schema.prisma User model:
//   adminDepartment  String?   // 'RIDES' | 'DELIVERIES' | 'SUPPORT' | null
// Then: npx prisma migrate dev --name add_admin_department && npx prisma generate

'use strict';
const { PrismaClient } = require('@prisma/client');
const bcrypt           = require('bcryptjs');
const prisma           = new PrismaClient();

const ADMINS = [
  {
    email: 'superadmin@diakite.com', password: 'SuperAdmin@123456',
    firstName: 'Super', lastName: 'Admin', phone: '+2348000000001',
    role: 'SUPER_ADMIN', adminDepartment: null,
  },
  {
    email: 'admin@diakite.com', password: 'Admin@123456',
    firstName: 'General', lastName: 'Admin', phone: '+2348000000002',
    role: 'ADMIN', adminDepartment: null,         // full admin — all sections
  },
  {
    email: 'rides@diakite.com', password: 'Rides@123456',
    firstName: 'Rides', lastName: 'Admin', phone: '+2348000000003',
    role: 'ADMIN', adminDepartment: 'RIDES',       // drivers + rides only
  },
  {
    email: 'deliveries@diakite.com', password: 'Deliveries@123456',
    firstName: 'Deliveries', lastName: 'Admin', phone: '+2348000000004',
    role: 'ADMIN', adminDepartment: 'DELIVERIES',  // partners + deliveries only
  },
  {
    email: 'support@diakite.com', password: 'Support@123456',
    firstName: 'Support', lastName: 'Agent', phone: '+2348000000005',
    role: 'SUPPORT', adminDepartment: 'SUPPORT',   // tickets + read-only users
  },
];

async function main() {
  for (const admin of ADMINS) {
    const hashed = await bcrypt.hash(admin.password, 10);
    const user = await prisma.user.upsert({
      where:  { email: admin.email },
      update: { adminDepartment: admin.adminDepartment },
      create: {
        email: admin.email, phone: admin.phone, password: hashed,
        firstName: admin.firstName, lastName: admin.lastName,
        role: admin.role, isVerified: true, isActive: true,
        adminDepartment: admin.adminDepartment,
      },
    });
    await prisma.wallet.upsert({
      where: { userId: user.id }, update: {},
      create: { userId: user.id, balance: 0, currency: 'NGN' },
    });
    console.log(`✅  ${admin.role}${admin.adminDepartment ? ` [${admin.adminDepartment}]` : ''} — ${admin.email}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());