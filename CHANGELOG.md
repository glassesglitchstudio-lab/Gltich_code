# Changelog

All notable changes to Glitch Code CLI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased](https://github.com/glassesglitchstudio-lab/Gltich_code/compare/v0.3.0...HEAD)

### Added
- GlitchCodeAI subsystem for Unreal Engine 5 (editor panel, quick tools, chat)
- Centralized error handling across modules
- Type safety improvements, Docker Compose support, VS Code publish workflow, plugin registry

### Fixed
- Test typecheck errors — SubTask description added
- `as any` type casts cleaned up across codebase

### Documentation
- VS Code Extension section added to landing page

## [v0.3.0](https://github.com/glassesglitchstudio-lab/Gltich_code/compare/v0.2.37...v0.3.0) — 2026-07-06

### Added
- VS Code Extension — full IDE integration for Glitch Code

### Documentation
- Landing page updated for v0.3.0

## [v0.2.37](https://github.com/glassesglitchstudio-lab/Gltich_code/compare/v0.2.34...v0.2.37) — 2026-07-06

### Added
- Repo Map feature — project-wide code structure visualization
- GitHub integration — `glitch pr` and `glitch issue` commands
- Landing page changelog section with animated timeline and roadmap
- Landing page "What's New" section with animations
- Standalone landing page HTML (no build step, Netlify-ready)
- OS evaluation workflow (6 platforms × 5 tests)
- Test coverage for fix/solve modules + cross-platform CI

### Fixed
- 22 bugs across critical/medium/low severity
- macOS-13 deprecated runner removed from CI
- YAML syntax — Windows CI steps use `shell: pwsh`
- Smoke test: Windows `bun install` hang resolved
- `docs/index.html` moved to root for GitHub Pages

### Documentation
- Landing page v0.2.35 and v0.2.37 details
- AGENTS.md updated with publish status

## [v0.2.34](https://github.com/glassesglitchstudio-lab/Gltich_code/compare/v0.2.33...v0.2.34) — 2026-07-01

### Added
- `maxGoalReact` / `maxPreReact` config schema
- PlusTwoCoder cross-critique debate mode + provider fallback API key validation

### Fixed
- Version mismatch — `GLITCHCODE_CHANNEL` prod → latest
- Copilot SDK type safety + Env API sync to `process.env`

### Changed
- TODO #7, #8, #9 completed
- Plugin TODOs cleaned up
- Provider-specific logic moved to `transform.ts`
- `llm.ts` TODO comments cleaned, removed redundant `systemHandling`

### Documentation
- `CONTRIBUTING.md`, `ARCHITECTURE.md`, README rewritten

## [v0.2.33](https://github.com/glassesglitchstudio-lab/Gltich_code/compare/v0.2.32...v0.2.33) — 2026-06-30

### Added
- `glitch fix` command — 7-phase automated issue resolution pipeline
- `glitch solve` command — general-purpose task decomposition with sub-agents
- LLM-based scoring (keyword fallback preserved)
- JSON review format for all review prompts

### Fixed
- Windows build auto-skip, `@parcel/watcher` optional
- Rebrand cleanup across build system

### Documentation
- AGENTS.md updated with session notes

## [v0.2.32](https://github.com/glassesglitchstudio-lab/Gltich_code/compare/v0.2.28...v0.2.32) — 2026-06-28

### Added
- `glitch plus-two-coder` (aliases: `ptc`, `debate`) — multi-model debate for code solutions
- Automatic provider fallback on quota/billing errors
- 10 new CLI features: `onboard`, `share`, `benchmark`, `plugins`, `team`, `review`, `suggest`, `theme`, `offline`, `history`
- 10 matching TUI slash commands

### Fixed
- Complete `@mimo-ai` → `@glitchcode` rebrand across all packages
- `custom-elements.d.ts` type declaration for app and enterprise packages
- npm package optimization — `files` field simplified
- Windows build: `--skip-install` reverted to Windows-only (cross-compilation needs native bindings)
- `@parcel/watcher` skipped on Windows only; `@opentui/core` kept

### Changed
- `publish.ts` rebranded (`@mimo-ai` → `@glitchcode`)

## [v0.2.28](https://github.com/glassesglitchstudio-lab/Gltich_code/compare/v0.2.27...v0.2.28) — 2026-06-26

### Added
- 6 new tools: `secret-scanner`, `api-tester`, `docker`, `code-migration`, `db-query`, `api-doc-gen`

## [v0.2.27](https://github.com/glassesglitchstudio-lab/Gltich_code/compare/v0.2.26...v0.2.27) — 2026-06-26

### Added
- 4 new tools + 29 typecheck errors fixed

## [v0.2.26](https://github.com/glassesglitchstudio-lab/Gltich_code/compare/v0.2.25...v0.2.26) — 2026-06-26

### Fixed
- Full rebrand `mimo` → `glitch` (hotfix)
- Build errors from rebrand resolved
- i18n changes restored (were corrupted by `Set-Content`)

### Added
- Auto-open login dialog on first run

### Changed
- Improved error messages when no providers configured

### Documentation
- AGENTS.md updated with v0.2.25 status
- README updated with real installation instructions (npm, GitHub Releases)

## [v0.2.25](https://github.com/glassesglitchstudio-lab/Gltich_code/compare/v0.2.24...v0.2.25) — 2026-06-25

### Fixed
- npm publish workflow — 11-platform matrix restored with `--target` flag
- `bun pm pack` used to resolve `catalog:` deps before npm publish
- `publish.ts` used for npm publish (resolves workspace deps)
- `@glitchcode/` binary publish skipped (scope not on npm)
- Windows ARM64 removed from matrix (no cross-compile support)

### Documentation
- README updated with real installation instructions

## [v0.2.22](https://github.com/glassesglitchstudio-lab/Gltich_code/compare/v0.2.21...v0.2.22) — 2026-06-25

### Fixed
- CI matrix aligned with `--single` build targets
- `windows-arm64` removed (Bun unsupported)

## [v0.2.21](https://github.com/glassesglitchstudio-lab/Gltich_code/compare/v0.2.20...v0.2.21) — 2026-06-25

### Fixed
- 12-platform build matrix restored
- Version bumped to 0.2.21

## [v0.2.19](https://github.com/glassesglitchstudio-lab/Gltich_code/compare/v0.2.18...v0.2.19) — 2026-06-25

### Fixed
- Simplified CI matrix to 3 platforms matching `--single` build targets
- Force correct version before npm publish

## [v0.2.16](https://github.com/glassesglitchstudio-lab/Gltich_code/compare/v0.2.15...v0.2.16) — 2026-06-25

### Fixed
- Added timeout to build jobs to prevent stuck builds
- Full 12-platform build matrix restored

## [v0.2.14](https://github.com/glassesglitchstudio-lab/Gltich_code/compare/v0.2.13...v0.2.14) — 2026-06-25

### Fixed
- Version bump 0.2.14 + CI matrix aligned with `--single` build targets
- Windows build targets aligned with `build.ts` output (`win32` → `windows`)

## [v0.2.12](https://github.com/glassesglitchstudio-lab/Gltich_code/compare/v0.2.11...v0.2.12) — 2026-06-25

### Fixed
- npm publish reverted — `dist/` files added back

## [v0.2.11](https://github.com/glassesglitchstudio-lab/Gltich_code/compare/v0.2.10...v0.2.11) — 2026-06-25

### Fixed
- npm package size reduced — `dist/` removed from `files`

## [v0.2.10](https://github.com/glassesglitchstudio-lab/Gltich_code/compare/v0.2.9...v0.2.10) — 2026-06-25

### Added
- 8 custom skills added to compose bundle
- `glitch init` enhanced

### Fixed
- npm install auto-creates config directories

## [v0.2.9](https://github.com/glassesglitchstudio-lab/Gltich_code/compare/v0.2.8...v0.2.9) — 2026-06-25

### Documentation
- GitHub installation instructions + CI/CD explanation

## [v0.2.8](https://github.com/glassesglitchstudio-lab/Gltich_code/compare/v0.2.7...v0.2.8) — 2026-06-25

### Changed
- Version bump to 0.2.8

## [v0.2.7](https://github.com/glassesglitchstudio-lab/Gltich_code/compare/v0.2.6...v0.2.7) — 2026-06-25

### Fixed
- Artifact path fixed, duplicates cleaned up, release workflow fixed

## [v0.2.6](https://github.com/glassesglitchstudio-lab/Gltich_code/compare/v0.2.5...v0.2.6) — 2026-06-25

### Changed
- Version bumped from 0.1.3 → 0.2.0

## [v0.2.5](https://github.com/glassesglitchstudio-lab/Gltich_code/compare/v0.2.4...v0.2.5) — 2026-06-24

### Added
- `--skip-install` flag for Windows build

## [v0.2.4](https://github.com/glassesglitchstudio-lab/Gltich_code/compare/v0.2.3...v0.2.4) — 2026-06-24

### Added
- `node-gyp` installation for Windows build support

## [v0.2.3](https://github.com/glassesglitchstudio-lab/Gltich_code/compare/v0.2.2...v0.2.3) — 2026-06-24

### Fixed
- CLI reference fixed: `@mimo-ai/cli` → `glitchcode-cli`

## [v0.2.2](https://github.com/glassesglitchstudio-lab/Gltich_code/compare/v0.2.1...v0.2.2) — 2026-06-24

### Added
- npmjs.com publish support — build + publish order fixed, `files` field added

## [v0.2.1](https://github.com/glassesglitchstudio-lab/Gltich_code/compare/v0.2.0...v0.2.1) — 2026-06-24

### Added
- GitHub Actions publish workflow — 12-platform parallel build
- GitHub Packages npm publish
- Automatic GitHub Release creation

## [v0.2.0](https://github.com/glassesglitchstudio-lab/Gltich_code/compare/v0.1.5...v0.2.0) — 2026-06-24

### Added
- `@glitchcode` scope for npm publish infrastructure
- Platform packages: `@glitchcode/glitchcode-*`
- `publish.ts` metadata: Glitch Code / GlassesCat AI
- `bin/glitch` wrapper with `@glitchcode` scope
- `postinstall.mjs` with `@glitchcode` platform package names

## [v0.1.5](https://github.com/glassesglitchstudio-lab/Gltich_code/compare/v0.1.3...v0.1.5) — 2026-06-23

### Added
- `glitchcode-cli` npm install works — binary downloaded via curl

## [v0.1.3](https://github.com/glassesglitchstudio-lab/Gltich_code/tree/v0.1.3) — 2026-06-23

### Added
- Initial npm package — binary downloaded via curl from GitHub
