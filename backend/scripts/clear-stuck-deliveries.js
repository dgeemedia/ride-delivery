// backend/scripts/clear-stuck-deliveries.js
// Run once: node backend/scripts/clear-stuck-deliveries.js
// Cancels all active/stuck deliveries so testing can resume cleanly.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Show all stuck deliveries first
  const stuck = await prisma.delivery.findMany({
    where: { status: { in: ['PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] } },
    include: {
      customer: { select: { firstName: true, lastName: true, email: true } },
      partner:  { select: { firstName: true, lastName: true } },
    },
    orderBy: { requestedAt: 'desc' },
  });

  console.log(`\nFound ${stuck.length} active delivery/deliveries:\n`);
  stuck.forEach(d => {
    console.log(`  ID:          ${d.id}`);
    console.log(`  Status:      ${d.status}`);
    console.log(`  Customer:    ${d.customer?.firstName} ${d.customer?.lastName} (${d.customer?.email})`);
    console.log(`  Partner:     ${d.partner ? `${d.partner.firstName} ${d.partner.lastName}` : 'unassigned'}`);
    console.log(`  Pickup:      ${d.pickupAddress}`);
    console.log(`  Drop-off:    ${d.dropoffAddress}`);
    console.log(`  Package:     ${d.packageDescription ?? '—'}`);
    console.log(`  Requested:   ${d.requestedAt}`);
    console.log('');
  });

  if (stuck.length === 0) {
    console.log('Nothing to cancel.\n');
    return;
  }

  const result = await prisma.delivery.updateMany({
    where: { status: { in: ['PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] } },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancellationReason: 'Cleared by admin script (stuck delivery cleanup)',
    },
  });

  console.log(`✅ Cancelled ${result.count} stuck delivery/deliveries.\n`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());