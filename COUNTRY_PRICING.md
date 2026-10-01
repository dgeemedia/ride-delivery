# Per-country pricing, commission, wallet & payout rules

Admin → **Pricing by country** (`/country-settings`). Pick a country; every value
on the page belongs to that country only.

## What can be set per country
| Tab | Settings |
|---|---|
| Ride pricing | base fare, per-km, per-minute, minimum fare, cancellation fee (car / bike / van / tricycle), booking fee, rounding step |
| Delivery pricing | base fee, per-km, per-kg |
| Commission | platform commission on rides (%) and deliveries (%) |
| Surge & timezone | surge windows (day / hours / multiplier) and the country's UTC offset |
| Wallet limits | min/max top-up, min transfer, % of the fare a driver/partner must hold to accept a job |
| Payouts | withdrawals on/off, min withdrawal (customers / earners), max, fee (flat + %) |
| Bonuses | driver & partner onboarding bonus |
| Cashback | on/off, trips needed, fixed or %, cap, "new users after" date |

Only a **Super Admin** can save. Every save is audit-logged with old → new values.

## How a value is resolved
`country's own value` → `global Settings value` → `starter/default`

* **Percentages and switches** inherit the global value, so nothing changes until
  you override.
* **Money amounts inherit only in the base currency (NGN).** The existing global
  numbers are Naira; inheriting "500" into a CFA/GNF/MGA market would be wrong.
  Other currencies get **starter values** (Naira numbers scaled by a rough rate,
  shown amber). They are a safety net, not a recommendation.
* Cashback's on/off switch never inherits into a new market — you opt each in.

**Nigeria is unchanged**: it reads the same global keys as before (verified by a
regression test that prices a trip identically to the old engine).

## Going live in a new country
1. Countries → the new country starts **Paused**.
2. Pricing by country → review Ride & Delivery pricing, save (or click *I've reviewed these*).
3. Countries → activate. Without step 2 the API returns `409 PRICING_NOT_REVIEWED`;
   you can knowingly override.

## Commission, including 0%
Commission is set per country and per service (rides / deliveries). **0% is valid**
(range 0–60%). It is applied at every point money moves: the fare quote, the ledger
record, the final fare, and the actual payment split that credits the driver/partner
(card, Orange Money, wallet and cash paths). Rides and deliveries have separate
rates within a country, and changing one country never affects another.

## Bugs fixed on the way (they affected every country, incl. Nigeria)
* **`payment.controller` split every payment 20% / 80% in seven places**, so the
  admin's commission never changed what a driver was credited. All seven now use the
  payer's country rate (`services/paymentSplit.service.js`).
* `ride.controller`/`delivery.controller` read `commissionRate` from the fare
  result, which never returned it — so the commission **recorded in the ledger was
  always 20% / 15%** regardless of the admin setting. It's now returned and used.
* **Cancellation fee was hard-coded to 200** and ignored the admin's per-vehicle
  cancellation-fee settings. Now uses the country's rate card.
* Surge windows used the **server's clock**; now the country's local time.
* Bulk **onboarding bonus credited one flat number in every currency**; now paid
  per country in its own currency.
* Revenue analytics **summed different currencies** and estimated the fee from
  today's rate; now per country using the fee recorded on each payment.
* Driver/partner payout **crashed after debiting the wallet** in mobile-money
  countries (`accountNumber.slice` on `undefined`).
* Re-running the country seed could **wipe an admin-saved Orange merchant key** and
  re-activate paused countries.
* Emails showed **₦ for every currency**.

## Deploy
```
cd backend
npx prisma migrate deploy        # adds CountrySetting (purely additive)
npm run seed                       # safe to re-run: keeps admin-saved settings
npx jest                          # 58 tests
```
Then set the Orange env vars (see `backend/ORANGE_SETUP.md`).

## Known limits / to do
* Rates for starter values are approximate and not purchasing-power adjusted.
* Trips already requested keep the fare they were quoted; commission for a trip
  is taken at completion using the country's rate at that moment.
* Mobile screens format money through the wallet currency; only icon components still mention `₦`.
* Malagasy, Sango and Setswana aren't translated: Madagascar and CAR open in
  French, Botswana in English.
* The app can't read the Play Store / App Store country. It uses the phone's
  region, then the account's country once signed up/in. A manual language choice
  always wins.
* Burkina Faso, Niger and Liberia are seeded but weren't on Orange's list for
  your contract — check whether Orange Money should stay enabled there.

## Withdrawals: how a driver/partner/customer enters where the money goes
One screen for everyone (Wallet → Withdraw), three steps: amount → destination → confirm.
The **server** decides which destination form the person sees (`payoutStyle`):

| Country rail | What they enter | Name check | Who sends the money |
|---|---|---|---|
| Orange countries (`MOBILE_MONEY`) | Orange Money number | none (Orange has no lookup) | Orange cash-out once B2C is on, else admin pays by hand |
| Nigeria (`BANK`) | pick bank + 10-digit account | automatic (Paystack) | Paystack/Flutterwave on admin **Approve** |
| Ghana (`MOMO`) | pick MTN / Vodafone(Telecel) / AirtelTigo + wallet number | format only (no name lookup exists) | **Flutterwave, automatically** on admin Approve |
| Gambia, Cape Verde, Togo, Benin (`MANUAL`) | bank/MoMo provider name, account or wallet number, name on account (typed) | none — admin checks by eye | admin pays outside the app, then **Mark as paid** |

The request is saved as a PENDING payout with that destination. The wallet is debited
immediately (full amount); a fee, if configured, is deducted from what is sent.
Admin → Wallets → Payouts shows destination, fee, currency and rail. Buttons:
**Approve** (automatic rails) · **Mark as paid** (manual rails, or after paying a failed
transfer by hand) · **Retry transfer** · **Reject** (refunds the full amount).
Once a provider has accepted a transfer, Retry and Reject are blocked (double-pay guard).

Fixed on the way: MANUAL countries were sent to Paystack on approval; a PROCESSING payout
could never be completed or refunded (and was hidden from the PENDING list); the app
enforced a fixed 500 minimum, 10-digit accounts and ₦ amounts everywhere; the
"non-withdrawable" onboarding bonus could actually be withdrawn (now blocked).


### Ghana mobile money (Flutterwave)
* Ghana's payout method is now `MOBILE_MONEY` (+ `MANUAL` as fallback). Re-run `npm run seed`
  to apply it to your existing Ghana row. (The seed overwrites a country's payout methods
  — if you customised Ghana's in the admin, set it back afterwards.)
* Sent as a Flutterwave transfer: `account_bank` = the operator's code, `account_number` =
  the number with country code (`233…`), `beneficiary_name` = the user's name. The operator
  code is read from Flutterwave's own bank list for Ghana at payout time (documented names
  `MTN` / `VODAFONE` / `AIRTELTIGO` are the fallback).
* **Enable Ghana mobile-money transfers on your Flutterwave account and fund the GHS balance.**
* **Failed transfers are now refunded automatically.** Approving marks a payout completed
  when the provider *accepts* it; a later failure used to leave the user without the money
  or a refund. Both Flutterwave (`transfer.completed`) and Paystack (`transfer.failed` /
  `transfer.reversed`) webhooks now refund the full amount once (idempotent). Make sure
  your Flutterwave dashboard webhook URL points at your existing Flutterwave webhook route
  (either `/api/payments/flutterwave/webhook` or the wallet one — both handle it) and the dashboard secret hash matches `FLUTTERWAVE_WEBHOOK_HASH`.


## Several payout options per country + bank rails country by country
A country's `payoutMethods` can now list several options; the person chooses between them
in the app (a switch at the top of the destination step) and the server routes **by the
option they chose**, not by the country (so a Senegalese *bank* payout never goes to Orange).

| Country | Options offered | Bank payouts via |
|---|---|---|
| Nigeria | Bank | Paystack/Flutterwave (unchanged, name auto-verified) |
| Ghana | Mobile money · Bank | Flutterwave (name lookup attempted) |
| Senegal, Côte d'Ivoire, Cameroon, Sierra Leone | Orange Money · Bank | Flutterwave (name typed, flagged *unverified* for the admin) |
| Mali, Guinea, Guinea-Bissau, DR Congo, Madagascar, Botswana, CAR, Burkina, Niger, Liberia | Orange Money only | — |
| Gambia, Cape Verde, Togo, Benin | typed details, paid by hand | — |

These are the countries where Flutterwave's documentation lists bank transfers. To add a
country later: Admin → Countries → add `BANK_TRANSFER` to its payout methods (the bank list
comes from Flutterwave's own list for that country). Branch codes (required by Flutterwave
for BJ, CM, CI, CD, GH, SN, SL) are looked up automatically — head-office branch, else the
first. **If a branch can't be determined nothing is sent**; the payout stays PROCESSING for
manual settlement. Test one real payout per country before relying on it.

## Which top-up methods a customer sees
Per country, from its `creditMethods` (Admin → Countries). The server only offers
what the country has and refuses other providers (Paystack is rejected outside NG/GH/CI).
Orange Money is hidden until the Orange keys are configured. Flutterwave coverage should be
confirmed with Flutterwave for each country listed with it.

## HOTFIX — registration outside Nigeria
Registering in Mali (or any non-Nigerian country) failed with "Please enter a valid
Nigerian phone number": the register route accepted only `+234…` / `0[7-9]…`. The
generic phone check used elsewhere also rejected real numbers from Mali, Senegal,
Côte d'Ivoire, Guinea and Guinea-Bissau. Fixed in the backend only — **no app rebuild**.

* `utils/phone.js` (new): Nigeria unchanged; other countries need `+<dial code>` + 6–12
  digits and the dial code must match the selected country. Non-NG numbers are stored as
  clean E.164 (`+22376427484`).
* Registration now refuses unknown or **paused** countries even if the API is called directly.
* The same country-aware check replaces `isMobilePhone()` on login, profile, transfers,
  Shield, corporate and admin routes.
* Shield WhatsApp links no longer assume Nigeria's `234` for numbers typed with a leading 0.

Deploy the full zip (the hotfix touches files that depend on earlier updates). Files changed: `src/utils/phone.js`, `src/routes/{auth,admin,user,corporate,shield,wallet}.routes.js`,
`src/controllers/auth.controller.js`, `src/controllers/shield.controller.js`,
`src/services/shield.service.js`. No migration.

Not changed: SMS one-time codes go through Termii (`ENABLE_SMS_DELIVERY`); confirm Termii
delivers in your new countries before turning SMS verification on there.
