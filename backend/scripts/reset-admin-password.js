// backend/prisma/reset-admin-passwords.js

'use strict';
const { PrismaClient } = require('@prisma/client');
const bcrypt           = require('bcryptjs');
const prisma           = new PrismaClient();

const ADMINS = [
  { email: 'superadmin@diakite.com', password: 'Diakite1@' },
  { email: 'admin@diakite.com',      password: 'Diakite1@' },
  { email: 'rides@diakite.com',      password: 'Diakite1@' },
  { email: 'deliveries@diakite.com', password: 'Diakite1@' },
  { email: 'support@diakite.com',    password: 'Diakite1@' },
];

async function main() {
  for (const admin of ADMINS) {
    const hashed = await bcrypt.hash(admin.password, 10);
    const user = await prisma.user.update({
      where:  { email: admin.email },
      data:   { password: hashed },
    });
    console.log(`✅  Password reset — ${user.email}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());