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
