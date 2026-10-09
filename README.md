# Wizarding OS website

Static, bilingual product website for Wizarding OS. The homepage previews the current app branch; privacy and support retain clearly scoped 0.4.4 documentation with a current-feature notice. The site is designed for GitHub Pages, works without JavaScript, and makes no network requests to third-party resources.

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

GitHub Actions deploys the repository root to GitHub Pages after candidate verification succeeds on `main`. Pull requests run source verification. Both verification modes validate the approved support contact.

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

## Homepage campaign artwork

The repository retains optimized WebP derivatives of the earlier approved campaign artwork (the current homepage uses real app screenshots instead):

- `assets/images/promo/en-01.webp` through `en-05.webp`
- `assets/images/promo/zh-01.webp` through `zh-05.webp`

Each derivative is 1086×1448, stripped of metadata, and kept below the site
image-size limit. Historical assets remain available. Current homepage copy describes opt-in remote AI explicitly; the current-feature notices distinguish it from the older local-only assistant.

## Verification

```bash
bash Scripts/verify_site.sh --source
bash Scripts/verify_site.sh --candidate
```

Source mode validates structure, metadata, local links, image references, accessibility basics, asset metadata, privacy constraints, prohibited claims, and the published support contact. Candidate mode applies the same contact requirements to the release candidate.

For local review:

```bash
python3 -m http.server 8000
```

Then open `http://127.0.0.1:8000/`. Lighthouse and browser audits should be run against this local origin before merge.

## Release gate

The site must not be merged or deployed with contact placeholders or sample email addresses. The English and Simplified Chinese privacy and support pages must show the approved address and link to the identical address. Do not add an App Store badge or availability statement until Apple has supplied a real public listing URL.

## October 2026 product story

Both homepages now explain four inputs (Plans, Projects, Library, Memory Basin),
two assistant modes and one reward system (Herb Garden). Plans and project/subtask
records provide work context; Library, memories and journeys provide personal
context for chat. Personal profile means interests, preferences and experiences,
not a personality diagnosis or an independently persisted inferred profile.

Implementation reviewed at app commit `f31d79ba01660fedbe6a6c0e7a1a2390d8fd8764`
on `codex/archive-recall-player-book-sources`, especially
`Features/Assistant/AssistantView.swift` and `Services/RemoteAIService.swift`.
The current implementation uses bounded selected references, not automatic access
to all historical records or a trained personal model. Homepage copy therefore
pairs the long-term recording vision with explicit selection and consent language.
No claim is made that all remote planning acceptance gates have passed.

### Current screenshot provenance

All files below are metadata-free WebP derivatives in `assets/images/features/`.
Chinese screenshots are labelled as such on the English page. Images link to
full-size local assets and preserve their original aspect ratios and contents.

| Derivative | Original |
| --- | --- |
| work-mode.webp | Owner upload IMG_3385.jpeg, 2026-10-07 |
| reference-consent.webp | Owner upload IMG_3386.png |
| reference-groups.webp | Owner upload IMG_3387.png |
| reference-details.webp | Owner upload IMG_3388.png |
| chat-mode.webp | Owner upload IMG_3389.jpeg |
| chat-context.webp | Owner upload IMG_3390.jpeg |
| chat-suggestions.webp | Owner upload IMG_3391.jpeg |
| chat-followup.webp | Owner upload IMG_3392.jpeg |
| planner.webp | Docs/Evals/Evidence/PROJECT-LINK-002/2026-09-18/iphone-planner-uncompleted.png |
| projects.webp | Docs/Evals/Evidence/PROJECT-OVERVIEW-EDIT-003/2026-09-23/zh-Hans-iphone-overview.png |
| library.webp | Docs/Evals/Evidence/FEEDBACK-2026-09-26/2026-10-06-archive-branch/import-root-zh-compact.png |
| memory.webp | Docs/Evals/Evidence/MEMORY-IA-002/2026-09-09/zh-Hans-iphone-6.1-memory-root.png |
| garden.webp | Docs/Evals/Evidence/GARDEN-PARTIAL-HARVEST-001/2026-09-22/zh-Hans-se-six.png |

Repository screenshots are from the app commit above. Some are historical UI or
explicit validation fixtures; the site labels examples and potential version
variation. Garden evidence confirms quantity/all harvesting but does not establish
physical-device accessibility acceptance. The October 6 grouped-reference and
DeepSeek smoke reports establish mode-specific reference selection and a live
chat response; broader remote-work and provider-switch acceptance remains open.

### Website verification for this update

- `Scripts/verify_site.sh --source` and `--candidate`: passed.
- Chromium checks on both homepages at 1440, 375 and 320 px: no horizontal
  overflow, no failed images, no page errors; expandable conversation opens.
- Desktop and mobile Chinese hero screenshots inspected with a CJK font installed
  in the verification environment. All product images keep their original ratios.
- No JavaScript, trackers, remote runtime assets or added production dependencies.

## Product film

Both homepages embed the owner-approved 45-second portrait film at `#film`.
`assets/video/wizardingos-promo-club.mp4` is the corrected version whose final
card displays `https://www.wizardingos.club/zh/`. It has Chinese on-screen text
and an original synthesized instrumental score. The poster is extracted at 2s.
The native player has controls, inline mobile playback and `preload="none"`;
there is no autoplay or third-party embed. The hero links to the film, and a
download link provides direct access to the MP4.
