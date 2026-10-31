# Approved Danqel artwork

These assets are faithful crops/resizes of the owner-supplied `DANQEL Social Boost Logo.png` (1254 × 1254), not a redrawn/generated substitute.

- `danqel-logo.webp`: complete artwork including the tagline.
- `danqel-mark.webp`: D/arrow symbol, sized for compact application chrome.
- `danqel-wordmark.webp`: original DANQEL / SOCIAL BOOST lettering.
- `../icons/*.png`: favicon, Apple touch icon, 192/512 application icons and a distinct maskable icon with safe-zone padding.

The original dark background is intentionally retained to preserve the supplied glow/lettering. The compact headers omit the tiny tagline for legibility; the full artwork retains it.

Regenerate with `python scripts/generate-brand-assets.py /path/to/approved-logo.png` in an environment with Pillow. Pillow is an asset-authoring tool only, not a frontend/build/runtime requirement. The committed assets are sufficient for `npm ci && npm run build`.
