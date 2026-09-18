# Orange Money — activation guide

Everything is built and merged. Orange Money stays **invisible to customers**
until the credentials below are present, so this can ship to production before
the keys arrive without affecting any existing market.

---

## 1. What happens today, with no keys

`orange.service.isOrangeConfigured()` returns `false` when any of
`ORANGE_CLIENT_ID`, `ORANGE_CLIENT_SECRET` or `ORANGE_MERCHANT_KEY` is missing.
That single flag gates everything:

| Surface | Behaviour without keys |
|---|---|
| Mobile `PaymentSelector` | Orange Money is filtered out of the method list |
| Mobile wallet top-up | Orange is not offered as a provider |
| `POST /api/payments/orange/*` | `503` with a "not activated yet" message |
| `POST /api/wallet/topup/orange` | `503` with the same message |
| Admin → Countries | Banner explaining Orange is built but not activated |
| Nigeria / Ghana / other markets | **Completely unaffected** |

You can seed and configure Orange markets now. They will simply show their
Flutterwave/Paystack fallbacks until you switch Orange on.

---

## 2. Environment variables

Add to `backend/.env`:

```bash
# ── Orange — checkout (required to activate) ──────────────────────────────
ORANGE_CLIENT_ID=
ORANGE_CLIENT_SECRET=
ORANGE_MERCHANT_KEY=

# 'dev' is Orange's sandbox. In production set the market path segment
# (ci, sn, ml, cm, bf, gn, cd, mg, ne …) or leave it unset and let each
# Country row's providerConfig.orange.webpayCountry decide.
ORANGE_WEBPAY_COUNTRY=dev

ORANGE_RETURN_URL=https://diakite.onrender.com/payment/orange/return
ORANGE_CANCEL_URL=https://diakite.onrender.com/payment/orange/cancel
ORANGE_NOTIF_URL=https://api.diakite.onrender.com/api/wallet/topup/orange/webhook

# Used to derive the notif_token HMAC that authenticates Orange's callback.
# Generate with: openssl rand -hex 32
ORANGE_WEBHOOK_SECRET=

# ── Orange — automatic payouts (optional, enable later) ───────────────────
ORANGE_B2C_ENABLED=false
ORANGE_MERCHANT_MSISDN=
ORANGE_B2C_PIN=

# Only override if Orange gives you a non-standard host
# ORANGE_API_BASE=https://api.orange.com
```

### Multi-market credentials

If Orange issues a **different merchant key per country**, leave
`ORANGE_MERCHANT_KEY` as your default and set the per-country override in the
admin dashboard, which writes to `Country.providerConfig`:

```json
{ "orange": { "merchantKey": "…", "webpayCountry": "sn", "lang": "fr" } }
```

DB config always wins over the env default. The admin API redacts merchant
keys on read (`••••1234`) and treats a redacted value submitted back as
"unchanged", so an admin editing the language can't wipe a key they can't see.

---

## 3. Database

```bash
npx prisma migrate deploy        # adds the new Country + providerRef columns
npx prisma generate
node prisma/seeds/countries.js   # seeds Orange markets (idempotent upsert)
```

The migration is additive and every new column is nullable —
`country.service.normalizeCountry()` derives sensible defaults for any row
created before it, so existing countries keep working untouched.

---

## 4. Register the webhooks with Orange

Two callback URLs, both authenticated by the `notif_token` HMAC rather than a
bearer token (Orange's servers have no session with us):

- Wallet top-ups → `POST /api/wallet/topup/orange/webhook`
- Ride/delivery payments → `POST /api/payments/orange/webhook`

Both re-verify against Orange's `/transactionstatus` endpoint before crediting
anything. **The callback payload's own status is never trusted**, so a forged
or replayed callback cannot credit a wallet.

---

## 5. Turning it on

1. Add the env vars, restart the API.
2. Open **Admin → Countries**. The "not activated" banner should be gone.
3. Pick an Orange market, confirm `ORANGE_MONEY` is in its credit methods.
4. Test a small top-up end to end in the Orange sandbox.
5. Flip `ORANGE_WEBPAY_COUNTRY` from `dev` to the live market path.

---

## 6. Payouts — the staged part

Checkout (money in) and cash-out (money out) are separate Orange contracts and
usually arrive at different times. That's why they're gated separately.

With `ORANGE_B2C_ENABLED=false`:

- Drivers in Orange markets **can still request withdrawals** — the form asks
  for an Orange Money number instead of bank details.
- An admin approving the payout gets a clear failure, and the payout stays
  `PROCESSING` rather than being marked `COMPLETED`. Ops settles it manually
  and the row remains visible and auditable.

Flip to `true` once the B2C contract is live and approvals will send
automatically.

---

## 7. Known limitations

- **No refund API.** Orange Web Payment has no merchant-initiated refund, so
  `refundUnified()` deliberately throws a `501` with instructions rather than
  marking a refund complete that never happened. Refunds in Orange markets are
  a manual Orange Money transfer.
- **No account-name lookup.** Unlike a NUBAN resolve, Orange won't confirm who
  owns a wallet number. The withdrawal screen validates the MSISDN shape and
  shows a "we can't confirm the account holder — double-check this number"
  notice instead of a false green tick.
- **Whole-unit currencies.** XOF, XAF and GNF have no minor unit. Decimal
  amounts are rejected with a clear error rather than being silently
  truncated, which would lose the customer's money.
