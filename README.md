# Wizarding OS website

Static, bilingual product, privacy, and support website for Wizarding OS 0.4.4. The site is designed for GitHub Pages, works without JavaScript, and makes no network requests to third-party resources.

## Routes

- `/` — English home
- `/privacy/` — English Privacy Policy
- `/support/` — English support
- `/zh/` — 简体中文首页
- `/zh/privacy/` — 简体中文隐私政策
- `/zh/support/` — 简体中文支持
- `/archive/` — preserved personal homepage that previously occupied the root route

The existing personal homepage was retained because its academic and project content remains useful. It was moved to `/archive/`, its images were re-encoded without metadata, and its preference storage was removed so the public site does not use cookies, local storage, or session storage.

## Architecture and privacy

The production site is plain semantic HTML and CSS. It has no runtime package manager, generator, backend, analytics, cookies, forms, remote fonts, remote scripts, third-party embeds, authentication, or database. All product images and metadata assets are served from this repository. A conservative CSP meta tag restricts content to the same origin.

GitHub Actions deploys the repository root to GitHub Pages after candidate verification succeeds on `main`. Pull requests run source verification. Candidate verification intentionally remains blocked until the owner supplies and approves a real monitored support email.

## Release screenshot provenance

Website screenshots are optimized, metadata-free derivatives of the seven English 0.4.4 Release screenshots from `vvsherryvv/Wizarding-OS`, branch `codex/0.4.4-app-store-release`, commit `bc437c4`.

| App source | Website derivative | Dimensions |
| --- | --- | --- |
| `Docs/AppStore/Screenshots/EN/01-wizarding-hall.jpg` | `assets/images/screenshot-hall.jpg` | 828×1800 |
| `Docs/AppStore/Screenshots/EN/02-magic-planner.jpg` | `assets/images/screenshot-planner.jpg` | 828×1800 |
| `Docs/AppStore/Screenshots/EN/03-memory-vault.jpg` | `assets/images/screenshot-memory-vault.jpg` | 828×1800 |
| `Docs/AppStore/Screenshots/EN/04-memory-magic.jpg` | `assets/images/screenshot-memory-magic.jpg` | 828×1800 |
| `Docs/AppStore/Screenshots/EN/05-collections.jpg` | `assets/images/screenshot-collections.jpg` | 828×1800 |
| `Docs/AppStore/Screenshots/EN/06-journey-archive.jpg` | `assets/images/screenshot-journey-archive.jpg` | 828×1800 |
| `Docs/AppStore/Screenshots/EN/07-recall-light.jpg` | `assets/images/screenshot-recall-light.jpg` | 828×1800 |

The local app icon is derived from `Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png`. The 1200×630 social preview combines that icon with the audited Hall screenshot and original site typography. App-repository originals are not modified.

## Verification

```bash
bash Scripts/verify_site.sh --source
bash Scripts/verify_site.sh --candidate
```

Source mode validates structure, metadata, local links, image references, accessibility basics, asset metadata, privacy constraints, and prohibited claims while reporting the owner email as a blocker. Candidate mode additionally requires the approved support email and must fail until it is supplied.

For local review:

```bash
python3 -m http.server 8000
```

Then open `http://127.0.0.1:8000/`. Lighthouse and browser audits should be run against this local origin before merge.

## Release gate

The site must not be merged or deployed with `[OWNER ACTION REQUIRED: INSERT SUPPORT EMAIL]`. Do not add an App Store badge or availability statement until Apple has supplied a real public listing URL.
