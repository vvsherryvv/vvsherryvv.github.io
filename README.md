# Owl website (0.4.5)

Static, bilingual product website for Owl `0.4.5` (TestFlight build `68`, app repository `vvsherryvv/Wizarding-App` branch `feature-20261028`, commit `07446eb`). The site is designed for GitHub Pages, works without JavaScript on product routes, and makes no network requests to third-party resources.

## Routes

- `/` — English home (`0.4.5`)
- `/privacy/` — English Privacy Policy (`0.4.5`)
- `/terms/` — English Terms of Use (`0.4.5`)
- `/support/` — English Support (`0.4.5`)
- `/zh/` — 简体中文首页 (`0.4.5`)
- `/zh/privacy/` — 简体中文隐私政策 (`0.4.5`)
- `/zh/terms/` — 简体中文使用条款 (`0.4.5`)
- `/zh/support/` — 简体中文支持与帮助 (`0.4.5`)
- `/archive/` — preserved personal homepage

## 0.4.5 Product Positioning & Content Structure

1. **Three-step core loop (`拆解目标 → 安排待办 → 反馈总结`)**:
   - Legacy collection modules (`草药园 Herb Garden`, `典藏馆 Library`, `记忆盆 Memory Basin`, `回忆之光 Recall Light`, `旅程 Journeys`, and `四大输入 Four Inputs`) have been removed from the 0.4.5 app and from the website navigation and sections.
   - The homepage focuses on breaking down goals in the Assistant, scheduling steps in Plans, and checking off progress in Daily Review.
2. **03 Interactive Tutorial (`新手教程`)**:
   - Reflects the 10-step guided onboarding in `Features/Minimal/MinimalViews.swift` using the exact in-app prompt: `点击输入框，写下你想完成的事。例如：这周开始阅读一本书，每天 20 分钟。` (`Tap the input and describe a goal. For example: read a book this week, 20 minutes a day.`).
3. **04 Reference Materials & Upcoming Roadmap (`我们对用户的了解 / 参考资料`)**:
   - Clearly distinguishes **Reference Materials** (live in `0.4.5`, local-first, opt-in, excludes photos and keys) from **“What we know about you / 我们对用户的了解”** (positioned as **coming soon / 即将上线**, not claimed as already shipped).

## Screenshot Provenance & Placeholder Notice

All 13 images in `assets/images/features/*.webp`, 17 gallery images in `assets/images/october-2026/*.webp`, and 7 `828×1800` JPEG derivatives in `assets/images/screenshot-*.jpg` have been regenerated without EXIF/XMP metadata from `0.4.5` captures (`daily-review-sheet.webp`, `08-daily-review-sheet.webp`, `09-daily-review-settings.webp`, and `screenshot-05-daily-review.jpg` updated with the latest 0.4.5 Daily Review captures).

## Verification

```bash
bash Scripts/verify_site.sh --source
bash Scripts/verify_site.sh --candidate
```
