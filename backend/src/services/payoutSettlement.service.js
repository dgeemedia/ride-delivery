// backend/src/services/payoutSettlement.service.js
//
// Applies the provider's FINAL word on a payout transfer.
//
// Approving a payout marks it COMPLETED as soon as Paystack/Flutterwave *accept*
// the transfer. For bank transfers that's usually the end of it, but mobile-money
// transfers routinely fail afterwards (wrong number, network unavailable) — and
// until now nothing listened, so the person lost the money: wallet already
// debited, payout still "COMPLETED", no refund.
//
// Webhooks call applyTransferResult(); it is idempotent (providers retry).
'use strict';

const prisma = require('../lib/prisma');
const notificationService = require('./notification.service');
const { logActivity } = require('../utils/auditLog');
const { formatMoney } = require('../utils/currency');

/**
 * @param {{reference:string, outcome:'SUCCESS'|'FAILED', message?:string, transferCode?:string}} r
 * @returns {Promise<{handled:boolean, action:string}>}
 */
const applyTransferResult = async ({ reference, outcome, message, transferCode }) => {
  if (!reference) return { handled: false, action: 'no-reference' };

  const payout = await prisma.payout.findFirst({ where: { reference } });
  if (!payout) return { handled: false, action: 'unknown-payout' };           // not ours (e.g. a refund transfer)

  if (outcome === 'SUCCESS') {
    if (payout.status === 'COMPLETED') return { handled: true, action: 'already-completed' };
    if (payout.status === 'FAILED')    return { handled: true, action: 'ignored-after-failure' };
    await prisma.$transaction([
      prisma.payout.update({ where: { id: payout.id }, data: { status: 'COMPLETED', processedAt: new Date(), transferError: null, ...(transferCode && { transferCode }) } }),
      prisma.walletTransaction.updateMany({ where: { reference: payout.reference }, data: { status: 'COMPLETED' } }),
    ]);
    return { handled: true, action: 'completed' };
  }

  // ── FAILED: the money did not leave. Give it back, once. ──
  if (payout.status === 'FAILED') return { handled: true, action: 'already-refunded' };

  const wallet = await prisma.wallet.findUnique({ where: { userId: payout.userId } });
  if (!wallet) return { handled: false, action: 'no-wallet' };

  // The wallet was debited the GROSS amount; Payout.amount is the net after fee.
  const refund = payout.payoutDetails?.grossAmount ?? payout.amount;
  const reason = `Transfer failed at the payment provider${message ? `: ${message}` : ''}`;

  try {
    await prisma.$transaction([
      prisma.wallet.update({ where: { userId: payout.userId }, data: { balance: { increment: refund } } }),
      prisma.payout.update({ where: { id: payout.id }, data: { status: 'FAILED', failureReason: reason, processedAt: new Date() } }),
      prisma.walletTransaction.updateMany({ where: { reference: payout.reference }, data: { status: 'FAILED' } }),
      // Unique reference = a second webhook delivery fails here and rolls the whole
      // transaction back, so the wallet can never be refunded twice.
      prisma.walletTransaction.create({
        data: { walletId: wallet.id, type: 'REFUND', amount: refund, description: `Withdrawal refund — ${reason}`, status: 'COMPLETED', reference: `REFUND-${payout.id}` },
      }),
    ]);
  } catch (err) {
    if (err.code === 'P2002') return { handled: true, action: 'already-refunded' };
    throw err;
  }

  logActivity({
    userId: payout.userId, action: 'payout_transfer_failed_refunded', entityType: 'Payout', entityId: payout.id,
    details: { amount: refund, currency: payout.currency, reason, reference: payout.reference },
  });

  await notificationService.notify({
    userId: payout.userId,
    title: 'Withdrawal failed — money returned',
    message: `Your withdrawal of ${formatMoney(refund, payout.currency)} could not be delivered, so it has been returned to your wallet. Please check the number or account and try again.`,
    type: notificationService.TYPES.WALLET_WITHDRAWAL,
    data: { payoutId: payout.id, amount: refund, reference: payout.reference },
  }).catch(() => {});

  return { handled: true, action: 'refunded' };
};

module.exports = { applyTransferResult };
