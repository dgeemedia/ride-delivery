// ─── OPTION A: Run this as a Prisma script ───────────────────────────────────
// Save as: backend/scripts/reactivate-superadmin.js
// Run with: node backend/scripts/reactivate-superadmin.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.update({
    where: { email: 'superadmin@diakite.com' },
    data: {
      isActive:         true,
      isSuspended:      false,
      suspendedAt:      null,
      suspendedBy:      null,
      suspensionReason: null,
    },
    select: { id: true, email: true, role: true, isActive: true, isSuspended: true },
  });

  console.log('✅ Reactivated:', user);
}

main()
  .catch(e => { console.error('❌ Failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());


// ─── OPTION B: Raw SQL (run in your DB client / Supabase / PlanetScale) ───────
/*
UPDATE "User"
SET
  "isActive"         = true,
  "isSuspended"      = false,
  "suspendedAt"      = NULL,
  "suspendedBy"      = NULL,
  "suspensionReason" = NULL
WHERE email = 'superadmin@diakite.com';
*/