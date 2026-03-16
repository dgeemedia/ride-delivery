// backend/scripts/clear-stuck-rides.js
// Run once: node backend/scripts/clear-stuck-rides.js
// Cancels all REQUESTED rides so testing can resume cleanly.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Show all stuck rides first
  const stuck = await prisma.ride.findMany({
    where: { status: { in: ['REQUESTED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] } },
    include: {
      customer: { select: { firstName: true, lastName: true, email: true } },
      driver:   { select: { firstName: true, lastName: true } },
    },
    orderBy: { requestedAt: 'desc' },
  });

  console.log(`\nFound ${stuck.length} active ride(s):\n`);
  stuck.forEach(r => {
    console.log(`  ID: ${r.id}`);
    console.log(`  Status: ${r.status}`);
    console.log(`  Customer: ${r.customer?.firstName} ${r.customer?.lastName} (${r.customer?.email})`);
    console.log(`  Driver: ${r.driver ? `${r.driver.firstName} ${r.driver.lastName}` : 'unassigned'}`);
    console.log(`  Pickup: ${r.pickupAddress}`);
    console.log(`  Requested: ${r.requestedAt}`);
    console.log('');
  });

  if (stuck.length === 0) {
    console.log('Nothing to cancel.\n');
    return;
  }

  // Cancel them all
  const result = await prisma.ride.updateMany({
    where: { status: { in: ['REQUESTED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] } },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancellationReason: 'Cleared by admin script (stuck ride cleanup)',
    },
  });

  console.log(`✅ Cancelled ${result.count} stuck ride(s).\n`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());