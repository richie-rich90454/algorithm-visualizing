# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Expansion program launch foundation: community files, issue and pull request templates, release automation, SEO metadata, and `robots.txt` / `sitemap.xml`.
- Hero GIF, screenshots, trailer, social card, and 13 category stills, all reproducible from `scripts/generate-media.ts`.
- Structured education writeups (intuition, invariants, correctness sketch, complexity rationale, uses, references, worked example) on all 785 modules, rendered in the app and on the static docs site.
- Static, indexable docs site generated from the registry: 806 pages, search index, sitemap, and JSON-LD.
- Seven new categories and 14 verified modules: machine learning and AI, cryptography and security, parallel and distributed systems, numerical methods and optimization, quantum algorithms, statistics and probability, production systems.
- Responsive mobile layout, light and dark themes, accessibility improvements, custom input forms, compare mode, share links, code export, a learning panel, and an offline service worker.

### Changed

- CI runs the Vitest package script, the manifest test derives its expected count from the registry, and the documentation now reports the live catalog size.

## [0.3.0] - 2026-11-18

### Added

- Final catalog batch: 46 verified modules covering statistics, production systems, and quantum simulation. The catalog now has 975 modules in 20 categories with 2,272 automated tests.
- VitePress documentation site generated entirely at build time from the registry: 996 pages, the app's design tokens, self-hosted fonts, search, dark mode, and structured metadata. Published under `dist/docs/` by `build:all`.
- A 392-entry research backlog for future catalog growth, sourced from current standards and papers.

### Changed

- Documentation source is no longer stored in git; `docs/` is regenerated on every build.

### Fixed

- Search now expands categories with matching algorithms so results are immediately clickable.
- Space no longer hijacks activation of focused buttons and links.
- Light-theme selected-category contrast now meets WCAG AA.
- Array bar labels no longer overlap neighbors or clip at narrow mobile widths.
- Empty state no longer displays "1 / 0".

## [0.2.0] - 2026-11-18

### Added

- Second catalog batch: 72 verified modules spanning optimizers, regression, classifiers, attention, reinforcement learning, hashing, key exchange, signatures, and post-quantum teaching models. The catalog now has 857 modules in 20 categories with 1,871 automated tests.
- All 857 modules carry the seven-part education writeup, rendered in the app and on 878 static documentation pages.
- Twenty category stills and a reproducible media generator whose social card count is derived from the registry.

### Changed

- Quality gate now allows foreign-language source titles in reference lists while still enforcing American English in prose.
- Manifest generator emits compact object literals, keeping the generated file readable as the catalog grows.

## [0.1.0] - 2026-11-18

### Added

- Expansion program start. Approved staged plan covering launch foundation, depth on the existing 771 modules, platform and UX work, and catalog growth.
- Quality gate and manifest consistency checks as required CI steps.
- Baseline: 771 algorithm modules across 13 categories, roughly 1,561 automated tests, lazy-loaded modules, and a live demo on GitHub Pages.

[Unreleased]: https://github.com/richie-rich90454/algorithm-visualizing/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/richie-rich90454/algorithm-visualizing/releases/tag/v0.3.0
[0.2.0]: https://github.com/richie-rich90454/algorithm-visualizing/releases/tag/v0.2.0
[0.1.0]: https://github.com/richie-rich90454/algorithm-visualizing/releases/tag/v0.1.0
