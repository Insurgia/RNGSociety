# RNGSociety

An all-in-one Whatnot seller app.

## Modules

### Singles Calculator

The original singles calculator remains available for fast pricing:

- Break-even start and recommended start
- Commission + processing % + fixed fee model
- Shipping allocation per card
- Detailed fee/profit breakdown

### Bag Builder (Pro)


### Purchase Calculator (Collection / Bundle Analyzer)

New module for evaluating bundle/collection buy opportunities before low-start streams.

- Inputs card list with qty + market value
- Calculates expected close, net after fees, risk-adjusted net
- Recommends max offer for target margin
- Auto-buckets cards into start tiers ($1/$2/$3/$5/$10/$15+/Fixed)
- Bulk paste parser (`Name - qty - $value`)
- Exports full analysis CSV and tier bucket CSV
- Saves settings + last 5 collection snapshots locally


Bag Builder is an advanced bag-building tracker for livestream sellers who let buyers combine wins across streams and pay shipping later.

#### What it does

- Customer + Bag + Bag Item ledger tracking
- Status workflow: `OPEN -> READY_TO_SHIP -> SHIPPING_PAID -> PACKED -> SHIPPED` (with HOLD/ARCHIVED support)
- Audit log of key actions for dispute handling
- Overdue and high-value flags
- Label view with QR deep-link to bag detail
- Packing slip print flow (print-to-PDF supported from browser)
- CSV exports:
  - single bag ledger
  - all-bags summary

## Authentication + Admin

The app now includes local login and an admin panel.

- Default admin credentials: `admin` / `admin123`
- Admin can create users, assign role (`admin` / `user`), toggle Pro access, disable users, and reset passwords.
- Bag Builder is Pro-gated per logged-in user (`admin` always has Pro access).

## Run locally

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

On Windows if `python3` is unavailable:

```bash
py -m http.server 4173
```

## Test

```bash
node --test tests/bagBuilderCore.test.js tests/purchaseCalculatorCore.test.js
```
