#!/usr/bin/env python3
import argparse
import random
from pathlib import Path

try:
    from PIL import Image, ImageEnhance, ImageFilter
except ImportError:
    raise SystemExit("Pillow is required. Install with: pip install pillow")


def affine_skew(img: Image.Image):
    w, h = img.size
    # mild affine skew/shear to simulate perspective-ish capture
    a = 1 + random.uniform(-0.06, 0.06)
    b = random.uniform(-0.12, 0.12)
    c = random.uniform(-0.04, 0.04) * w
    d = random.uniform(-0.12, 0.12)
    e = 1 + random.uniform(-0.06, 0.06)
    f = random.uniform(-0.04, 0.04) * h
    return img.transform((w, h), Image.AFFINE, (a, b, c, d, e, f), resample=Image.BICUBIC)


def augment(img: Image.Image):
    out = img.rotate(random.uniform(-18, 18), resample=Image.BICUBIC, expand=False)
    out = affine_skew(out)

    out = ImageEnhance.Brightness(out).enhance(random.uniform(0.7, 1.3))
    out = ImageEnhance.Contrast(out).enhance(random.uniform(0.75, 1.35))
    out = ImageEnhance.Color(out).enhance(random.uniform(0.8, 1.25))

    if random.random() < 0.35:
        out = out.filter(ImageFilter.GaussianBlur(radius=random.uniform(0.3, 1.2)))
    if random.random() < 0.25:
        out = out.filter(ImageFilter.SHARPEN)

    return out


def main():
    ap = argparse.ArgumentParser(description="Generate angle/lighting variants per card image")
    ap.add_argument("--input", default="data/pokemon/images", help="Folder with source card images")
    ap.add_argument("--output", default="data/pokemon/augmented", help="Output folder")
    ap.add_argument("--per-image", type=int, default=40, help="Variants per source image")
    ap.add_argument("--max-images", type=int, default=0, help="Limit source images (0=all)")
    args = ap.parse_args()

    in_dir = Path(args.input)
    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)

    images = sorted(in_dir.glob("*.jpg"))
    if args.max_images > 0:
        images = images[: args.max_images]

    if not images:
        raise SystemExit(f"No .jpg files found in {in_dir}")

    count = 0
    for idx, img_path in enumerate(images, start=1):
        card_id = img_path.stem
        card_out = out_dir / card_id
        card_out.mkdir(parents=True, exist_ok=True)

        base = Image.open(img_path).convert("RGB")
        base.save(card_out / "base.jpg", quality=92)

        for i in range(args.per_image):
            aug = augment(base)
            aug.save(card_out / f"aug_{i:03d}.jpg", quality=random.randint(58, 90))
            count += 1

        if idx % 100 == 0:
            print(f"Processed {idx}/{len(images)} cards")

    print(f"Done. Generated {count} augmented images for {len(images)} cards in {out_dir}")


if __name__ == "__main__":
    main()
