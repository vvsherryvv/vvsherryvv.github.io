# Jieyi Sheng website

Static bilingual (EN / 简体中文) GitHub Pages site. No build step, no third-party requests.
The bilingual root is a witch-flight personal portfolio: an original SVG witch, a dusk sky, optional scroll parallax and ambient movement, two app projects, a personal introduction, and contact links. Owl and Wizarding OS keep their existing product pages.
`assets/js/flight.js` progressively enhances the homepage with route progress and a motion toggle. All content and navigation work without JavaScript. Reduced Motion disables animation and parallax; the toggle also pauses smooth scrolling. `assets/js/site.js` handles product screenshot fallbacks. Homepage art, fonts, CSS, and scripts are served locally; no third-party runtime requests, cookies, or browser storage are introduced.

## Routes

- `/` and `/zh/` — personal introduction and app portfolio: Owl, Wizarding OS, and an About link
- `/owl/` and `/zh/owl/` — Owl product home (kept structurally parallel)
- `/wizarding-os/` and `/zh/wizarding-os/` — Wizarding OS landing
- `/privacy/`, `/zh/privacy/` — Owl Privacy Policy (paths unchanged)
- `/terms/`, `/zh/terms/` — Owl Terms of Use (paths unchanged)
- `/support/`, `/zh/support/` — Owl Support (paths unchanged)
- `/archive/` — personal homepage

## Owl home page structure

1. Sticky slim nav (How it works · Companions · Pet · Privacy · language · "Get the beta")
2. Hero — goals and to-dos plus a pet that levels up, TestFlight CTA, hero phone screenshot
3. How it works — 4 steps, one phone screenshot each:
   getting-to-know-you interview → goal breakdown with AI preview → schedule as to-dos → evening daily review
4. Pet companions — owl, cat, toad; the Christmas toggle only previews artwork (in the app each outfit costs 300 points)
5. Pet — points, level, shop, co-raise (pet stays with the inviter after unbind), custom-pet reservation (2,000 points available to submit, charged when the schedule is confirmed, one open reservation), widgets and a Lock Screen Live Activity
6. Privacy & permissions — local goals; account-backed points and co-raising → `/privacy/`
7. Download — TestFlight CTA (`https://testflight.apple.com/join/9BAkFSvp`)
8. Footer — Support, Privacy Policy, Terms of Use, language switch

## Screenshot slots (replace these files to update the site)

Every phone frame loads a fixed file. To swap in real screenshots, overwrite the file with the same name — no HTML changes needed.

| File | Used for |
|---|---|
| `assets/screens/home.webp` | Hero phone (Owl page and the app hub card) |
| `assets/screens/breakdown.webp` | Features · Goal breakdown with AI preview |
| `assets/screens/pets.webp` | Features · Pet companion picker |
| `assets/screens/redeem.webp` | Points & pets · Redeem page |
| `assets/screens/coraise.webp` | Points & pets · Co-raise page |

English pages use the same names with `-en` (e.g. `home-en.webp`).

Requirements:
- iPhone **portrait** WebP, currently **900 × 1957** (downscaled from 1206 × 2622, iPhone 17 Pro). Any portrait iPhone size works; the frame uses `object-fit: cover`, so other aspect ratios are cropped slightly. If you use a different size, also update `width`/`height` on the `<img>` tags.
- Screenshot cards show the **top ~85 %** of the screenshot (the phone is cropped at the card's bottom edge), so keep the key UI in the upper part of the screen.
- Export without EXIF/GPS metadata (the verifier rejects it) and keep each file under 1.5 MB; consider re-encoding to keep the page light.
- Status bar: clean (full battery, 9:41) and no personal data in the screenshot.
- **Two sets:** the zh Owl home (`/zh/owl/`) uses `assets/screens/<slot>.png` (Chinese UI); the EN Owl home (`/owl/`) uses `assets/screens/<slot>-en.png` (English UI). `assets/js/site.js` falls back to `<slot>.png` if an `-en` file is missing. `verify_site.sh` requires both sets.
- Current state (2026-10-30, screenshot set v2, demo data work/study/fitness): all ten files are real 0.4.5 screenshots (750 × 1626, 256-colour PNG, metadata stripped) — zh set `hero`, `feature-profile` (interview Q1), `feature-breakdown`, `feature-schedule`, `feature-review`; English-UI set `hero-en`, `feature-profile-en`, `feature-breakdown-en`, `feature-schedule-en`, `feature-review-en`. Keep the `width="1179" height="2556"` attributes — they only set the aspect ratio.

Pet art: `assets/images/pets/pet-{owl,cat,toad}-512.webp` and `pet-*-christmas-512.webp` (512 px web versions of the finalized v2 / christmas-clean art).
Share image: `assets/social/og-owl.jpg` (1200 × 630).

## Verification

```bash
bash Scripts/verify_site.sh --source
bash Scripts/verify_site.sh --candidate
```

## Witch-flight homepage — 2026-11-05

- Scope: English and Chinese homepage only; existing product, policy, support, and archive routes retained.
- Visual direction: dusk blue, warm moonlight, original glasses-wearing witch on a broom, illustrated cloud layers, serif typography, and a four-stop flight log. Inspired by the scroll-led exploration of the supplied Anna Cheng reference; no reference assets or source code are reused.
- Assets: `assets/images/flight/witch.svg`, `clouds.svg`; presentation: `assets/css/flight.css`; optional interactions: `assets/js/flight.js`.
- Checks: both source and candidate audits passed (14 HTML pages, 12 required routes, 10 screenshot slots); JavaScript syntax check passed.
- Browser verification: English at 1440 × 900 and Chinese at 390 × 844; working product navigation, no unloaded images on the tested home, no horizontal overflow at 390 px, and pause/resume state verified. Route navigation to projects updated progress to 25% and the selected destination. System Reduced Motion is handled in CSS and JavaScript; actual OS preference switching was not exercised.
