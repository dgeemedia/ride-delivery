// view-users.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function formatDate(date) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString();
}

async function main() {
  try {
    // ── All users with their driver/delivery profiles ──────────────────────
    const users = await prisma.user.findMany({
      include: {
        driverProfile:   { select: { isApproved: true, vehicleType: true, vehiclePlate: true } },
        deliveryProfile: { select: { isApproved: true, vehicleType: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // ── Approved drivers ───────────────────────────────────────────────────
    const approvedDrivers = users.filter(u => u.driverProfile?.isApproved);

    // ── Pending drivers ────────────────────────────────────────────────────
    const pendingDrivers = users.filter(
      u => u.driverProfile && !u.driverProfile.isApproved
    );

    // ── Approved delivery partners ─────────────────────────────────────────
    const approvedPartners = users.filter(u => u.deliveryProfile?.isApproved);

    // ── Pending delivery partners ──────────────────────────────────────────
    const pendingPartners = users.filter(
      u => u.deliveryProfile && !u.deliveryProfile.isApproved
    );

    // ── Plain customers (no driver/delivery profile) ───────────────────────
    const customers = users.filter(
      u => !u.driverProfile && !u.deliveryProfile
    );

    // ── Print helpers ──────────────────────────────────────────────────────
    const printUser = (u) => {
      console.log(`  • ${u.firstName} ${u.lastName}`);
      console.log(`    Email   : ${u.email}`);
      console.log(`    Phone   : ${u.phone}`);
      console.log(`    Role    : ${u.role}`);
      console.log(`    Active  : ${u.isActive}  |  Suspended: ${u.isSuspended}`);
      console.log(`    Joined  : ${formatDate(u.createdAt)}`);
      if (u.driverProfile) {
        console.log(`    Vehicle : ${u.driverProfile.vehicleType} — ${u.driverProfile.vehiclePlate}`);
      }
      if (u.deliveryProfile) {
        console.log(`    Vehicle : ${u.deliveryProfile.vehicleType}`);
      }
      console.log();
    };

    const printSection = (title, list) => {
      console.log('═'.repeat(60));
      console.log(` ${title} (${list.length})`);
      console.log('═'.repeat(60));
      if (list.length === 0) {
        console.log('  None\n');
      } else {
        list.forEach(printUser);
      }
    };

    // ── Output ─────────────────────────────────────────────────────────────
    console.log('\n📋  USER OVERVIEW\n');
    console.log(`  Total users          : ${users.length}`);
    console.log(`  Customers            : ${customers.length}`);
    console.log(`  Approved drivers     : ${approvedDrivers.length}`);
    console.log(`  Pending drivers      : ${pendingDrivers.length}`);
    console.log(`  Approved partners    : ${approvedPartners.length}`);
    console.log(`  Pending partners     : ${pendingPartners.length}`);
    console.log();

    printSection('✅  APPROVED DRIVERS',          approvedDrivers);
    printSection('⏳  PENDING DRIVERS',            pendingDrivers);
    printSection('✅  APPROVED DELIVERY PARTNERS', approvedPartners);
    printSection('⏳  PENDING DELIVERY PARTNERS',  pendingPartners);
    printSection('👤  CUSTOMERS',                  customers);

  } catch (err) {
    console.error('FAILED:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();