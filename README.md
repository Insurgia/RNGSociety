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
- configurable Whatnot-style fee model: commission % + processing % + fixed processing $
- break-even computed with cent-level fee rounding
- recommended start rounded to nearest `$0.25`
- detailed expandable cost breakdown (commission, processing, total fees, net earnings, profit)
- copy-to-clipboard listing snippet
- localStorage persistence for last-used values


### Image Matcher Lab (new)

A standalone in-browser image matching prototype is available at:
- /image-matching.html

Use it to:
1. Build a local reference DB from a folder of images
2. Upload/capture a query image
3. See top visual matches by perceptual hash distance

No OCR required for this flow.


### Dataset Augmentation (Phase 2.5)

To improve real-world camera matching without scraping search engines, generate synthetic angle/lighting variants:

`ash
python scripts/augment_card_images.py --input data/pokemon/images --output data/pokemon/augmented --per-image 50 --max-images 2000
`

This creates a folder per card id with many variants (ase.jpg, ug_*.jpg).

