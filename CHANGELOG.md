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

## [0.20.0] - 2026-11-20

### Added

- Wave N of the broad research backlogs: 51 verified modules across machine learning, cryptography, production systems, mathematics, graph theory, strings, statistics, numerical optimization, quantum computing, distributed systems, and the classic categories. The catalog now has 2,341 modules in 20 categories with 7,073 automated tests.

### Fixed

- Raised the Vitest per-test timeout to 30s so heavy algorithm tests no longer flake under full-suite parallel load.

### Changed

- Regenerated the manifest, VitePress documentation, media kit, and all public counts for the expanded catalog.

## [0.19.0] - 2026-11-19

### Added

- Wave M of the broad research backlogs: 71 verified modules across machine learning, cryptography, production systems, mathematics, graph theory, strings, trees, statistics, geometry, numerical optimization, quantum computing, distributed systems, dynamic programming, flow, and game theory. The catalog now has 2,290 modules in 20 categories with 6,900 automated tests.

### Fixed

- Use the American spelling "labeled" in the Lemke-Howson Nash module.

### Changed

- Regenerated the manifest, VitePress documentation, media kit, and all public counts for the expanded catalog.

## [0.18.0] - 2026-11-19

### Added

- Wave L of the broad research backlogs: 84 verified modules across machine learning, cryptography, production systems, mathematics, graph theory, strings, trees, statistics, geometry, numerical optimization, quantum computing, distributed systems, dynamic programming, flow, game theory, and data structures. The catalog now has 2,219 modules in 20 categories with 6,640 automated tests.

### Changed

- Regenerated the manifest, VitePress documentation, media kit, and all public counts for the expanded catalog.

## [0.17.0] - 2026-11-19

### Added

- Wave K of the broad research backlogs: 93 verified modules across machine learning, cryptography, production systems, mathematics, graph theory, shortest paths, strings, trees, statistics, geometry, numerical optimization, quantum computing, distributed systems, dynamic programming, flow, game theory, and minimum spanning trees. The catalog now has 2,135 modules in 20 categories with 6,319 automated tests.

### Changed

- Regenerated the manifest, VitePress documentation, media kit, and all public counts for the expanded catalog.

## [0.16.0] - 2026-11-19

### Added

- Wave J of the research backlogs: 14 verified modules across machine learning, geometry, game theory, and the classic categories. Three agents found no genuinely distinct candidates, confirming mature categories are exhausted. The catalog now has 2,042 modules in 20 categories with 5,981 automated tests.

### Fixed

- Customizable route planning now includes cell interior nodes when computing shortcuts, so overlay queries return exact shortest-path costs.

### Changed

- Regenerated the manifest, VitePress documentation, media kit, and all public counts for the expanded catalog.

## [0.15.0] - 2026-11-19

### Added

- Wave I of the research backlogs: 37 verified modules across machine learning, statistics, production systems, strings, mathematics, geometry, game theory, quantum computing, and cryptography. The catalog crossed 2,000 modules and now has 2,028 modules in 20 categories with 5,931 automated tests.

### Changed

- Regenerated the manifest, VitePress documentation, media kit, and all public counts for the expanded catalog.

## [0.14.0] - 2026-11-19

### Added

- Wave H of the research backlogs: 75 verified modules across machine learning, distributed systems, statistics, production systems, strings, geometry, data structures, game theory, mathematics, quantum computing, cryptography, and numerical optimization. The catalog now has 1,991 modules in 20 categories with 5,793 automated tests.

### Changed

- Regenerated the manifest, VitePress documentation, media kit, and all public counts for the expanded catalog.

## [0.13.0] - 2026-11-19

### Added

- Wave G of the research backlogs: 84 verified modules across machine learning, distributed systems, statistics, production systems, strings, geometry, data structures, game theory, mathematics, quantum computing, cryptography, and numerical optimization. The catalog now has 1,916 modules in 20 categories with 5,535 automated tests.

### Changed

- Regenerated the manifest, VitePress documentation, media kit, and all public counts for the expanded catalog.

## [0.12.0] - 2026-11-19

### Added

- Wave F of the research backlogs: 80 verified modules across machine learning, distributed systems, statistics, production systems, strings, geometry, data structures, game theory, mathematics, quantum computing, cryptography, and numerical optimization. The catalog now has 1,832 modules in 20 categories with 5,270 automated tests.
- A new 450-candidate backlog (`backlog-next.json`) to sustain catalog growth.

### Changed

- Regenerated the manifest, VitePress documentation, media kit, and all public counts for the expanded catalog.

## [0.11.0] - 2026-11-19

### Added

- Wave E of the research backlogs: 88 verified modules across machine learning, distributed systems, statistics, production systems, strings, geometry, data structures, game theory, mathematics, quantum computing, cryptography, and numerical optimization. The catalog now has 1,752 modules in 20 categories with 4,967 automated tests.

### Changed

- Regenerated the manifest, VitePress documentation, media kit, and all public counts for the expanded catalog.

## [0.10.0] - 2026-11-19

### Added

- Wave D of the research backlogs: 96 verified modules across game theory, numerical optimization, statistics, production systems, machine learning, quantum computing, mathematics, geometry, data structures, and cryptography. The catalog now has 1,664 modules in 20 categories with 4,658 automated tests.

### Changed

- Regenerated the manifest, VitePress documentation, media kit, and all public counts for the expanded catalog.

## [0.9.0] - 2026-11-19

### Added

- Wave C of the research backlogs: 93 verified modules across machine learning and AI, distributed systems, quantum computing, statistics, production systems, mathematics, data structures, and cryptography. The catalog now has 1,568 modules in 20 categories with 4,348 automated tests.

### Fixed

- Corrected a deque rotation typo and five optimizer test type errors, and made Karger-Stein min-cut reliably find the optimum by repeating the recursion.

### Changed

- Regenerated the manifest, VitePress documentation, media kit, and all public counts for the expanded catalog.

## [0.8.0] - 2026-11-19

### Added

- Wave B of the new backlogs: 109 verified modules across string algorithms, dynamic programming, data structures, geometry, shortest paths, spanning trees, mathematics, flow, trees, machine learning, and cryptography. The catalog now has 1,475 modules in 20 categories with 4,003 automated tests.

### Fixed

- Renamed eleven optimizer and hash modules so their filenames match their exported ids, restoring the manifest metadata-fidelity check.

### Changed

- Regenerated the manifest, VitePress documentation, media kit, and all public counts for the expanded catalog.

## [0.7.0] - 2026-11-19

### Added

- Wave A of the new backlogs: 82 verified modules across sorting, searching, and graph theory. The catalog now has 1,366 modules in 20 categories with 3,681 automated tests.
- Continued semantic-duplicate rejection, keeping redundant algorithms out of the catalog.

### Changed

- Regenerated the manifest, VitePress documentation, media kit, and all public counts for the expanded catalog.

## [0.6.0] - 2026-11-19

### Added

- Final backlog sweep: 41 verified modules across mathematics, game theory, geometry, strings, graphs, shortest paths, dynamic programming, flow, data structures, trees, and spanning trees. The catalog now has 1,284 modules in 20 categories with 3,438 automated tests.
- Two research backlogs: `backlog-core.json` (377 classical candidates) and `backlog-modern.json` (395 modern candidates), both collision-free.
- A semantic-duplicate guard across every sweep that rejected more than 100 near-duplicate candidates, keeping the catalog free of redundant modules.

### Changed

- The manifest generator emits parsed JSON for default inputs, avoiding a TypeScript union complexity overflow as the catalog grows.
- Regenerated the manifest, VitePress documentation, media kit, and all public counts for the expanded catalog.

## [0.5.0] - 2026-11-19

### Added

- Wave 3 of the 2026 backlog: 76 verified modules across probability, production systems, search, graph theory, and shortest paths. The catalog now has 1,243 modules in 20 categories with 3,321 automated tests.
- A semantic-duplicate guard that skipped 20 near-duplicate candidates rather than adding redundant modules.
- Moved the new search and shortest-path modules into the established `search/` and `path/` folders so each category has one physical location.

### Changed

- Regenerated the manifest, VitePress documentation, media kit, and all public counts for the expanded catalog.

## [0.4.0] - 2026-11-18

### Added

- The 2026 backlog waves: 192 verified modules spanning modern attention and decoding variants, post-quantum cryptography, consensus protocols, distributed systems, numerical methods, quantum algorithms, and probability distributions. The catalog now has 1,167 modules in 20 categories with 3,033 automated tests.
- Every new module is added in its own commit with its test, pseudocode, and full education writeup.

### Changed

- Regenerated the manifest, VitePress documentation, media kit, and all public counts for the expanded catalog.

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

[Unreleased]: https://github.com/richie-rich90454/algorithm-visualizing/compare/v0.20.0...HEAD
[0.20.0]: https://github.com/richie-rich90454/algorithm-visualizing/releases/tag/v0.20.0
[0.19.0]: https://github.com/richie-rich90454/algorithm-visualizing/releases/tag/v0.19.0
[0.18.0]: https://github.com/richie-rich90454/algorithm-visualizing/releases/tag/v0.18.0
[0.17.0]: https://github.com/richie-rich90454/algorithm-visualizing/releases/tag/v0.17.0
[0.16.0]: https://github.com/richie-rich90454/algorithm-visualizing/releases/tag/v0.16.0
[0.15.0]: https://github.com/richie-rich90454/algorithm-visualizing/releases/tag/v0.15.0
[0.14.0]: https://github.com/richie-rich90454/algorithm-visualizing/releases/tag/v0.14.0
[0.13.0]: https://github.com/richie-rich90454/algorithm-visualizing/releases/tag/v0.13.0
[0.12.0]: https://github.com/richie-rich90454/algorithm-visualizing/releases/tag/v0.12.0
[0.11.0]: https://github.com/richie-rich90454/algorithm-visualizing/releases/tag/v0.11.0
[0.10.0]: https://github.com/richie-rich90454/algorithm-visualizing/releases/tag/v0.10.0
[0.9.0]: https://github.com/richie-rich90454/algorithm-visualizing/releases/tag/v0.9.0
[0.8.0]: https://github.com/richie-rich90454/algorithm-visualizing/releases/tag/v0.8.0
[0.7.0]: https://github.com/richie-rich90454/algorithm-visualizing/releases/tag/v0.7.0
[0.6.0]: https://github.com/richie-rich90454/algorithm-visualizing/releases/tag/v0.6.0
[0.5.0]: https://github.com/richie-rich90454/algorithm-visualizing/releases/tag/v0.5.0
[0.4.0]: https://github.com/richie-rich90454/algorithm-visualizing/releases/tag/v0.4.0
[0.3.0]: https://github.com/richie-rich90454/algorithm-visualizing/releases/tag/v0.3.0
[0.2.0]: https://github.com/richie-rich90454/algorithm-visualizing/releases/tag/v0.2.0
[0.1.0]: https://github.com/richie-rich90454/algorithm-visualizing/releases/tag/v0.1.0
