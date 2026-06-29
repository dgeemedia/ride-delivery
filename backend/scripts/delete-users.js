// delete-users.js
//
// USAGE:
//   node scripts/delete-users.js                          -> DRY RUN (default)
//   node scripts/delete-users.js --confirm                -> live run, asks Y/N per user
//   node scripts/delete-users.js --confirm --yes-to-all   -> live run, no prompts
//
const { PrismaClient } = require('@prisma/client');
const readline = require('readline');

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const LIVE_RUN = args.includes('--confirm');
const SKIP_ASK = args.includes('--yes-to-all');

// ── Selection rules ─────────────────────────────────────────────────────
const EMAIL_DOMAIN_TO_DELETE = /@diakite\.com$/i;

const EXTRA_EMAILS_TO_DELETE = [
  'okikiola@gmail.com',
  'johndoedriver@gmail.com',
  'raphmich@driver.com',
  'adiakite@diakiteautos.com',
  'steve@gmail.com',
  'abc@gmail.com',
  'opeyemiipadeola1@gmail.conlm',
  'johndoepartner@gmail.com',
  'raphmich@partner.com',
  'couriertest@gmail.com',
  'testing203@gm.cm',
  'doublegee4all@gmail.com',
  'olumah4all@yahoo.com',
  'mypadicrib@gmail.com',
  'mypadifood@gmail.com',
  'dgeetutor@gmail.com',
  'johndoe@gmail.com',
  'madriagbavi1@gmail.com',
  'testing33@hg.bm',
  'etetim@gmail.com',
  'james@gmail.com',
  'reg@gmail.com',
];

// Bypasses PROTECTED_ROLES check — these will be deleted even if ADMIN/SUPPORT
const FORCE_DELETE_EMAILS = [
  'support@diakite.com',
  'deliveries@diakite.com',
  'rides@diakite.com',
  'admin@diakite.com',
];

const PROTECTED_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'];
const NEVER_DELETE_EMAILS = [];

function isEligible(user) {
  const email = (user.email || '').toLowerCase();
  if (NEVER_DELETE_EMAILS.map(e => e.toLowerCase()).includes(email)) return false;
  if (FORCE_DELETE_EMAILS.map(e => e.toLowerCase()).includes(email)) return true;
  if (PROTECTED_ROLES.includes(user.role)) return false;
  return EMAIL_DOMAIN_TO_DELETE.test(email) ||
    EXTRA_EMAILS_TO_DELETE.map(e => e.toLowerCase()).includes(email);
}

// ── Prompt helper (used OUTSIDE transactions) ────────────────────────────
function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function getRelatedCounts(userId) {
  const [
    ridesAsCustomer, ridesAsDriver,
    deliveriesAsCustomer, deliveriesAsPartner,
    payments, ratings, payouts,
    transfersSent, transfersReceived,
    supportTickets, appFeedback, commissions,
    isCompanyAdmin, companyEmployments,
  ] = await Promise.all([
    prisma.ride.count({ where: { customerId: userId } }),
    prisma.ride.count({ where: { driverId: userId } }),
    prisma.delivery.count({ where: { customerId: userId } }),
    prisma.delivery.count({ where: { partnerId: userId } }),
    prisma.payment.count({ where: { userId } }),
    prisma.rating.count({ where: { userId } }),
    prisma.payout.count({ where: { userId } }),
    prisma.transfer.count({ where: { senderId: userId } }),
    prisma.transfer.count({ where: { recipientId: userId } }),
    prisma.supportTicket.count({ where: { userId } }),
    prisma.appFeedback.count({ where: { userId } }),
    prisma.commissionLedger.count({ where: { earnerUserId: userId } }),
    prisma.company.findUnique({ where: { adminUserId: userId }, select: { id: true, name: true } }),
    prisma.companyEmployee.count({ where: { userId } }),
  ]);

  return {
    ridesAsCustomer, ridesAsDriver,
    deliveriesAsCustomer, deliveriesAsPartner,
    payments, ratings, payouts,
    transfersSent, transfersReceived,
    supportTickets, appFeedback, commissions,
    isCompanyAdmin, companyEmployments,
  };
}

function summaryLine(counts) {
  const parts = [];
  if (counts.ridesAsCustomer || counts.ridesAsDriver)
    parts.push(`rides: ${counts.ridesAsCustomer + counts.ridesAsDriver}`);
  if (counts.deliveriesAsCustomer || counts.deliveriesAsPartner)
    parts.push(`deliveries: ${counts.deliveriesAsCustomer + counts.deliveriesAsPartner}`);
  if (counts.payments) parts.push(`payments: ${counts.payments}`);
  if (counts.ratings) parts.push(`ratings: ${counts.ratings}`);
  if (counts.payouts) parts.push(`payouts: ${counts.payouts}`);
  if (counts.transfersSent || counts.transfersReceived)
    parts.push(`transfers: ${counts.transfersSent + counts.transfersReceived}`);
  if (counts.supportTickets) parts.push(`tickets: ${counts.supportTickets}`);
  if (counts.appFeedback) parts.push(`feedback: ${counts.appFeedback}`);
  if (counts.commissions) parts.push(`commissions: ${counts.commissions}`);
  if (counts.companyEmployments) parts.push(`companyEmployee rows: ${counts.companyEmployments}`);
  if (counts.isCompanyAdmin) parts.push(`⚠ COMPANY ADMIN of "${counts.isCompanyAdmin.name}"`);
  return parts.length ? parts.join(', ') : 'no related records';
}

// ── Full wipe — NO readline/prompts inside here ──────────────────────────
async function deleteUserFully(user) {
  // Pre-flight company check OUTSIDE the transaction to avoid timeout
  const ownedCompany = await prisma.company.findUnique({
    where: { adminUserId: user.id },
    select: { id: true, name: true },
  });
  if (ownedCompany) {
    throw new Error(
      `BLOCKED: user is the admin of Company "${ownedCompany.name}" (${ownedCompany.id}). ` +
      `Reassign or delete the Company manually first.`
    );
  }

  // Collect IDs outside the transaction too (faster, no timeout risk)
  const rides = await prisma.ride.findMany({
    where: { OR: [{ customerId: user.id }, { driverId: user.id }] },
    select: { id: true },
  });
  const rideIds = rides.map(r => r.id);

  const deliveries = await prisma.delivery.findMany({
    where: { OR: [{ customerId: user.id }, { partnerId: user.id }] },
    select: { id: true },
  });
  const deliveryIds = deliveries.map(d => d.id);

  const tickets = await prisma.supportTicket.findMany({
    where: { userId: user.id },
    select: { id: true },
  });
  const ticketIds = tickets.map(t => t.id);

  // Now run the actual deletes in a transaction — pure writes, no I/O, no timeouts
  await prisma.$transaction(async (tx) => {
    const userId = user.id;

    // 1. CommissionLedger
    await tx.commissionLedger.deleteMany({ where: { earnerUserId: userId } });
    if (rideIds.length || deliveryIds.length) {
      await tx.commissionLedger.deleteMany({
        where: { OR: [{ rideId: { in: rideIds } }, { deliveryId: { in: deliveryIds } }] },
      });
    }

    // 2. CorporateTrip
    if (rideIds.length || deliveryIds.length) {
      await tx.corporateTrip.deleteMany({
        where: { OR: [{ rideId: { in: rideIds } }, { deliveryId: { in: deliveryIds } }] },
      });
    }

    // 3. DuoPayTransaction (ride-linked rows)
    if (rideIds.length) {
      await tx.duoPayTransaction.deleteMany({ where: { rideId: { in: rideIds } } });
    }

    // 4. ShieldSession
    if (rideIds.length || deliveryIds.length) {
      await tx.shieldSession.deleteMany({
        where: { OR: [{ rideId: { in: rideIds } }, { deliveryId: { in: deliveryIds } }] },
      });
    }

    // 5. Rating
    await tx.rating.deleteMany({ where: { userId } });
    if (rideIds.length || deliveryIds.length) {
      await tx.rating.deleteMany({
        where: { OR: [{ rideId: { in: rideIds } }, { deliveryId: { in: deliveryIds } }] },
      });
    }

    // 6. Payment
    await tx.payment.deleteMany({ where: { userId } });
    if (rideIds.length || deliveryIds.length) {
      await tx.payment.deleteMany({
        where: { OR: [{ rideId: { in: rideIds } }, { deliveryId: { in: deliveryIds } }] },
      });
    }

    // 7. Ride / Delivery
    if (rideIds.length) await tx.ride.deleteMany({ where: { id: { in: rideIds } } });
    if (deliveryIds.length) await tx.delivery.deleteMany({ where: { id: { in: deliveryIds } } });

    // 8. Payout, Transfer, AppFeedback
    await tx.payout.deleteMany({ where: { userId } });
    await tx.transfer.deleteMany({ where: { OR: [{ senderId: userId }, { recipientId: userId }] } });
    await tx.appFeedback.deleteMany({ where: { userId } });

    // 9. SupportTicket + replies
    if (ticketIds.length) {
      await tx.ticketReply.deleteMany({ where: { ticketId: { in: ticketIds } } });
      await tx.supportTicket.deleteMany({ where: { id: { in: ticketIds } } });
    }

    // 10. CompanyEmployee rows (as employee, not admin)
    await tx.companyEmployee.deleteMany({ where: { userId } });

    // 11. User (cascades: DriverProfile, DeliveryPartnerProfile, Wallet,
    //     WalletTransaction, OtpVerification, Notification, AdminProfile,
    //     ShieldBeneficiary, ShieldSession, DuoPayAccount, DuoPayTransaction,
    //     authored TicketReplies)
    await tx.user.delete({ where: { id: userId } });
  }, {
    timeout: 30000, // 30 s — generous for users with lots of records
  });
}

async function main() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  const candidates = users.filter(isEligible);

  console.log(`\n${LIVE_RUN ? '🔴 LIVE RUN' : '🟡 DRY RUN'} — ${candidates.length} candidate(s) found out of ${users.length} total users\n`);

  const forcedProtected = candidates.filter(u =>
    FORCE_DELETE_EMAILS.map(e => e.toLowerCase()).includes(u.email.toLowerCase()) &&
    PROTECTED_ROLES.includes(u.role)
  );
  if (forcedProtected.length) {
    console.log('⚠️  WARNING: The following users have protected roles but are in FORCE_DELETE_EMAILS:');
    forcedProtected.forEach(u => console.log(`   ${u.email}  [${u.role}]`));
    console.log('   They WILL be deleted if you proceed.\n');
  }

  if (candidates.length === 0) {
    console.log('Nothing matches the current selection rule.\n');
    await prisma.$disconnect();
    return;
  }

  console.log('Gathering related-record counts...\n');
  console.log('─'.repeat(90));

  const withCounts = [];
  for (const u of candidates) {
    const counts = await getRelatedCounts(u.id);
    withCounts.push({ user: u, counts });
    console.log(`${u.firstName} ${u.lastName}  <${u.email}>  [${u.role}]`);
    console.log(`   → ${summaryLine(counts)}`);
  }
  console.log('─'.repeat(90));

  if (!LIVE_RUN) {
    console.log(`\nThis was a DRY RUN — nothing was deleted.`);
    console.log(`To actually delete: node scripts/delete-users.js --confirm\n`);
    await prisma.$disconnect();
    return;
  }

  // ── Collect all confirmations BEFORE any deletes ─────────────────────
  // This is the key fix: no I/O happens inside a transaction.
  console.log(`\nAbout to PERMANENTLY delete ${candidates.length} user(s) and ALL related records.\n`);

  const approved = [];

  if (SKIP_ASK) {
    approved.push(...withCounts);
  } else {
    for (const item of withCounts) {
      const { user, counts } = item;
      const answer = await ask(
        `Delete "${user.firstName} ${user.lastName}" <${user.email}> (${summaryLine(counts)})? [y/N/q]: `
      );
      if (answer === 'q') {
        console.log('\nStopped by user — no deletions performed yet.\n');
        await prisma.$disconnect();
        return;
      }
      if (answer === 'y' || answer === 'yes') {
        approved.push(item);
      }
    }
  }

  if (approved.length === 0) {
    console.log('\nNothing approved for deletion.\n');
    await prisma.$disconnect();
    return;
  }

  console.log(`\nProceeding to delete ${approved.length} user(s)...\n`);

  // ── Now delete — no prompts, no I/O, transactions won't time out ─────
  let deletedCount = 0;
  let failedCount = 0;

  for (const { user, counts } of approved) {
    try {
      await deleteUserFully(user);
      console.log(`  ✅ Deleted ${user.email}`);
      deletedCount++;
    } catch (err) {
      console.log(`  ❌ Could not delete ${user.email} — ${err.message}`);
      failedCount++;
    }
  }

  const skippedCount = withCounts.length - approved.length;
  console.log('\n' + '─'.repeat(90));
  console.log(`Done. Deleted: ${deletedCount}  |  Skipped: ${skippedCount}  |  Failed: ${failedCount}`);
  console.log('─'.repeat(90) + '\n');

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('FAILED:', err.message);
  await prisma.$disconnect();
  process.exit(1);
});