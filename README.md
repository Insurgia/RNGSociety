# RNGSociety

An all-in-one Whatnot seller app.

## MVP: TCG Stream Profit Calculator

This repo now includes a production-ready single-page calculator to help TCG streamers estimate:

- break-even starting price
- recommended start with configurable profit buffer
- estimated profit after commission, payment processing, and shipping allocation

### Run locally

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

### Features shipped

- configurable shipping-per-card math
- configurable commission fee percentage
- configurable payment processing fee (`2.9% + $0.30` by default)
- recommended start rounded to nearest `$0.25`
- detailed expandable cost breakdown
- copy-to-clipboard listing snippet
- localStorage persistence for last-used values

## Git sync troubleshooting (Windows-friendly)

If you see merge conflicts after running a command like `git cherry-pick <commit>`, you can safely reset and sync without manually resolving conflict markers.

### 1) Cancel the broken cherry-pick

```bash
git cherry-pick --abort
```

### 2) Make sure you are on the branch you want to run

```bash
git checkout main
```

### 3) Force your local branch to match GitHub exactly

```bash
git fetch origin
git reset --hard origin/main
```

### 4) Verify you have the expected fee fields

```bash
findstr /n "Processing (%)" index.html
findstr /n "Processing Fixed ($)" index.html
```

### 5) Restart local server from repo root

```bash
py -m http.server 4173
```

Then hard refresh `http://localhost:4173` with `Ctrl+F5`.
