# Changelog

## [0.3.1](https://github.com/PrintrFi/printr-mcp/compare/v0.3.0...v0.3.1) (2026-02-25)


### Bug Fixes

* trigger 0.3.1 patch release ([601dda4](https://github.com/PrintrFi/printr-mcp/commit/601dda4d1988f0a7f685bd57e3c270a859e5c1b7))

## [0.3.0](https://github.com/PrintrFi/printr-mcp/compare/v0.2.2...v0.3.0) (2026-02-25)


### Features

* **cli/setup:** interactive client selection before configuring ([209d26a](https://github.com/PrintrFi/printr-mcp/commit/209d26a3eb93b6278214e57317c696cadac07cf1))
* **cli:** add setup command with switch routing and install script ([f091a86](https://github.com/PrintrFi/printr-mcp/commit/f091a86b08dc17b14ee46f092e7bc4b5090af354))
* **signing:** make rpc_url optional with per-chain default fallback ([352ba9f](https://github.com/PrintrFi/printr-mcp/commit/352ba9ff1d8ab601d86ca6efb3d47bc083a4da24))
* **ux:** append terminal QR code to browser signing URLs ([e438138](https://github.com/PrintrFi/printr-mcp/commit/e43813856273995cf1cb58fa96f10854510f351d))
* **wallet:** add encrypted keystore and wallet management tools ([9a08b1d](https://github.com/PrintrFi/printr-mcp/commit/9a08b1df145f6b2b531df7002f85d11fbd307d1a))


### Bug Fixes

* **build:** skip apps/wallet when absent; exclude react-devtools-core from bundle ([1af467b](https://github.com/PrintrFi/printr-mcp/commit/1af467b729cdc94859023e502669a7278e3b4b5d))
* mcp initialization ([855f824](https://github.com/PrintrFi/printr-mcp/commit/855f82438dcca88a4e77729762199afeca35c120))

## [0.2.2](https://github.com/PrintrFi/printr-mcp/compare/v0.2.1...v0.2.2) (2026-02-24)


### Bug Fixes

* **server:** read version from package.json instead of hardcoded string ([161e509](https://github.com/PrintrFi/printr-mcp/commit/161e50950d2c6762f05e2d33ac46751654cc6173))

## [0.2.1](https://github.com/PrintrFi/printr-mcp/compare/v0.2.0...v0.2.1) (2026-02-24)


### Bug Fixes

* **env:** apply default public ai-integration api key ([9d64670](https://github.com/PrintrFi/printr-mcp/commit/9d64670105b692723444c56fe33733b3ff372240))

## [0.2.0](https://github.com/PrintrFi/printr-mcp/compare/v0.1.0...v0.2.0) (2026-02-24)

### Features

* **tools:** add printr_launch_token for one-call token creation and signing ([d9432c9](https://github.com/PrintrFi/printr-mcp/commit/d9432c9))

## [0.1.0](https://github.com/PrintrFi/printr-mcp/releases/tag/v0.1.0) (2026-02-23)

### Features

* **server:** migrate wallet pages to hono jsx with tailwind and alpine ([3101500](https://github.com/PrintrFi/printr-mcp/commit/3101500))
* **signing:** add interactive wallet provisioning for evm and svm ([bbd5979](https://github.com/PrintrFi/printr-mcp/commit/bbd5979))
* **signing:** add EVM_WALLET_PRIVATE_KEY and SVM_WALLET_PRIVATE_KEY env var fallbacks ([4101502](https://github.com/PrintrFi/printr-mcp/commit/4101502))
* **generate-image:** add printr_generate_image tool, gated on OPENROUTER_API_KEY ([f01b50c](https://github.com/PrintrFi/printr-mcp/commit/f01b50c))
* **create-token:** add image_path support and OpenRouter auto-generation fallback ([ccd2041](https://github.com/PrintrFi/printr-mcp/commit/ccd2041))

### Bug Fixes

* update tests to use LOCAL_SESSION_ORIGIN instead of hardcoded http://localhost ([c90d56b](https://github.com/PrintrFi/printr-mcp/commit/c90d56b))
* default openrouter image gen model ([a8edec5](https://github.com/PrintrFi/printr-mcp/commit/a8edec5))
