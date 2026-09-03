// backend/scripts/find-orphaned-profiles.js
const prisma = require('../src/lib/prisma');

async function main() {
  const orphanedDrivers = await prisma.user.findMany({
    where: { role: 'DRIVER', driverProfile: null },
    select: { id: true, email: true, phone: true, createdAt: true },
  });

  const orphanedPartners = await prisma.user.findMany({
    where: { role: 'DELIVERY_PARTNER', deliveryProfile: null },
    select: { id: true, email: true, phone: true, createdAt: true },
  });

  console.log(`\nDrivers with no driverProfile (${orphanedDrivers.length}):`);
  console.table(orphanedDrivers);

  console.log(`\nDelivery partners with no deliveryProfile (${orphanedPartners.length}):`);
  console.table(orphanedPartners);
}

main()
  .catch((err) => {
    console.error('Script failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });