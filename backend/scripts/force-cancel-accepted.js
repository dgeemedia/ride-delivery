// backend/scripts/force-cancel-accepted.js
// Run: node scripts/force-cancel-accepted.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rides = await prisma.ride.findMany({
    where: { status: { in: ['REQUESTED','ACCEPTED','ARRIVED','IN_PROGRESS'] } },
    include: {
      customer: { select: { firstName:true, lastName:true, email:true } },
      driver:   { select: { firstName:true, lastName:true, email:true } },
    }
  });

  console.log(`\nFound ${rides.length} active ride(s):\n`);
  rides.forEach(r => {
    console.log(`  ID: ${r.id}`);
    console.log(`  Status: ${r.status}`);
    console.log(`  Customer: ${r.customer?.firstName} ${r.customer?.lastName} (${r.customer?.email})`);
    console.log(`  Driver: ${r.driver ? r.driver.firstName+' '+r.driver.lastName+' ('+r.driver.email+')' : 'none'}`);
    console.log('');
  });

  if (!rides.length) { console.log('Nothing to cancel.\n'); return; }

  const { count } = await prisma.ride.updateMany({
    where: { status: { in: ['REQUESTED','ACCEPTED','ARRIVED','IN_PROGRESS'] } },
    data:  { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: 'Dev reset' }
  });

  // Also reset driver isOnline so they can go back online cleanly
  await prisma.driverProfile.updateMany({
    where: { isOnline: true },
    data:  { isOnline: false }
  });

  console.log(`✅ Cancelled ${count} ride(s). All drivers set offline.\n`);
  console.log('Now:\n  1. Restart backend\n  2. Driver logs in → toggle online\n  3. Customer requests ride\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());