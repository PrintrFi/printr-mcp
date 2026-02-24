# Changelog

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
