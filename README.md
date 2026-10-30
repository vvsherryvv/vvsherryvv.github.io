# Owl website

Static, bilingual (EN / 简体中文) product website for **Owl** — iPhone app, current version `0.4.5` on TestFlight.
Hosted on GitHub Pages. No build step, no third-party requests, works without JavaScript
(`assets/js/site.js` only adds the optional Christmas-outfit toggle for the pet companions).

## Routes

- `/` and `/zh/` — product home (kept structurally parallel)
- `/privacy/`, `/zh/privacy/` — Privacy Policy
- `/terms/`, `/zh/terms/` — Terms of Use
- `/support/`, `/zh/support/` — Support
- `/archive/` — separate personal homepage (not part of the product site)

## Home page structure

1. Sticky slim nav (How it works · Companions · Privacy · language · "Get the beta")
2. Hero — one-line positioning, TestFlight CTA, hero phone screenshot
3. How it works — 4 steps, one phone screenshot each:
   getting-to-know-you interview → goal breakdown with AI preview → schedule as todos → evening daily review
4. Pet companions — owl, cat, toad (+ Christmas outfits toggle)
5. Privacy & permissions — skippable, revocable, data stays yours → `/privacy/`
6. Download — TestFlight CTA (`https://testflight.apple.com/join/9BAkFSvp`)
7. Footer — Support, Privacy Policy, Terms of Use, language switch

## Screenshot slots (replace these files to update the site)

Every phone frame loads a fixed file. To swap in real screenshots, overwrite the file with the same name — no HTML changes needed.

| File | Used for |
|---|---|
| `assets/screens/hero.png` | Hero phone |
| `assets/screens/feature-profile.png` | 1 · Getting-to-know-you interview / personal profile |
| `assets/screens/feature-breakdown.png` | 2 · Goal breakdown with AI preview |
| `assets/screens/feature-schedule.png` | 3 · Steps scheduled as todos |
| `assets/screens/feature-review.png` | 4 · Evening daily review & feedback |

Requirements:
- iPhone **portrait** PNG, ideally **1179 × 2556** (iPhone 15/16 Pro). Any portrait iPhone size works; the frame uses `object-fit: cover`, so other aspect ratios are cropped slightly. If you use a different size, also update `width`/`height` on the `<img>` tags.
- Feature cards show the **top ~75 %** of the screenshot (the phone is cropped at the card's bottom edge), so keep the key UI in the upper part of the screen.
- Export without EXIF/GPS metadata (the verifier rejects it) and keep each file under 1.5 MB; consider re-encoding to keep the page light.
- Status bar: clean (full battery, 9:41) and no personal data in the screenshot.
- **Two sets:** the zh home (`/zh/`) uses `assets/screens/<slot>.png` (Chinese UI); the EN home (`/`) uses `assets/screens/<slot>-en.png` (English UI). `assets/js/site.js` falls back to `<slot>.png` if an `-en` file is missing. `verify_site.sh` requires both sets.
- Current state (2026-10-30, screenshot set v2, demo data work/study/fitness): all ten files are real 0.4.5 screenshots (750 × 1626, 256-colour PNG, metadata stripped) — zh set `hero`, `feature-profile` (interview Q1), `feature-breakdown`, `feature-schedule`, `feature-review`; English-UI set `hero-en`, `feature-profile-en`, `feature-schedule-en`, `feature-review-en`. **Exception:** `feature-breakdown-en.png` is a copy of the zh breakdown (the EN breakdown demo content is hardcoded Chinese in the app); replace it when an English breakdown shot exists. Keep the `width="1179" height="2556"` attributes — they only set the aspect ratio.

Pet art: `assets/images/pets/pet-{owl,cat,toad}-512.webp` and `pet-*-christmas-512.webp` (512 px web versions of the finalized v2 / christmas-clean art).
Share image: `assets/social/og-owl.jpg` (1200 × 630).

## Verification

```bash
bash Scripts/verify_site.sh --source
bash Scripts/verify_site.sh --candidate
```
