// backend/src/routes/paymentReturn.routes.js
//
// Landing pages Orange sends the customer to after the hosted checkout:
//   ORANGE_RETURN_URL = https://<api-host>/payment/orange/return
//   ORANGE_CANCEL_URL = https://<api-host>/payment/orange/cancel
//
// These are only a friendly "you can go back to the app" screen. They NEVER credit
// anything — the wallet is credited by the verified webhook / status check, so the
// pages deliberately ignore every query parameter (nothing is reflected back).
'use strict';

const express = require('express');
const router = express.Router();

const page = ({ title, titleEn, body, bodyEn, tone }) => `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0b0b0b;color:#f5f5f5}
  main{max-width:360px;padding:32px 24px;text-align:center}
  .dot{width:56px;height:56px;border-radius:50%;margin:0 auto 20px;background:${tone}}
  h1{font-size:22px;margin:0 0 8px} p{margin:0 0 20px;line-height:1.5;color:#c9c9c9}
  .en{margin-top:24px;padding-top:20px;border-top:1px solid #2a2a2a;font-size:14px}
</style></head><body><main>
  <div class="dot"></div>
  <h1>${title}</h1><p>${body}</p>
  <div class="en"><h1 style="font-size:17px">${titleEn}</h1><p>${bodyEn}</p></div>
</main></body></html>`;

const noStore = (res) => res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });

router.get('/return', (req, res) => {
  noStore(res).type('html').send(page({
    title: 'Paiement envoyé',
    body: "Retournez dans l'application Diakite. Votre portefeuille sera crédité dès que Orange Money confirme le paiement.",
    titleEn: 'Payment submitted',
    bodyEn: 'Return to the Diakite app. Your wallet is credited as soon as Orange Money confirms the payment.',
    tone: '#f97316',
  }));
});

router.get('/cancel', (req, res) => {
  noStore(res).type('html').send(page({
    title: 'Paiement annulé',
    body: "Aucun montant n'a été débité. Retournez dans l'application Diakite pour réessayer.",
    titleEn: 'Payment cancelled',
    bodyEn: 'You have not been charged. Return to the Diakite app to try again.',
    tone: '#6b7280',
  }));
});

module.exports = router;
