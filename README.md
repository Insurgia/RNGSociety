# RNGSociety

An all-in-one Whatnot seller app.

## MVP: TCG Stream Profit Calculator

This repo now includes a production-ready single-page calculator to help TCG streamers estimate:

- break-even starting price
- recommended start with configurable profit buffer
- estimated profit after platform fee and shipping allocation

### Run locally

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

### Features shipped

- configurable shipping-per-card math
- configurable platform fee percentage
- recommended start rounded to nearest `$0.25`
- detailed expandable cost breakdown
- copy-to-clipboard listing snippet
- localStorage persistence for last-used values
