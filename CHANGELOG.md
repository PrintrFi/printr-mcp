# Changelog

## [0.11.0](https://github.com/PrintrFi/printr-mcp/compare/v0.10.1...v0.11.0) (2026-03-16)


### Features

* add creator fee querying and claiming tools ([594fbe2](https://github.com/PrintrFi/printr-mcp/commit/594fbe2121f089e892f0dcc58e43aaec9c497861))
* **tools:** add printr_claim_fees tool ([7a977c1](https://github.com/PrintrFi/printr-mcp/commit/7a977c1fcaf4bf981163dd79c1b2f68e47f547aa))

## [0.10.1](https://github.com/PrintrFi/printr-mcp/compare/v0.10.0...v0.10.1) (2026-03-12)


### Bug Fixes

* **svm:** skip websocket for http-only rpcs and fix drain rent-exempt ([63485a2](https://github.com/PrintrFi/printr-mcp/commit/63485a2d60d59dcc457f29b30b5291e7737d674c))
* **svm:** skip websocket for http-only rpcs and fix drain rent-exempt ([7470cf7](https://github.com/PrintrFi/printr-mcp/commit/7470cf7451d0680d4ddfaaef859c663dce21e48a))

## [0.10.0](https://github.com/PrintrFi/printr-mcp/compare/v0.9.0...v0.10.0) (2026-03-12)


### Features

* persistent state with master deployment password for wallet recovery ([353fd99](https://github.com/PrintrFi/printr-mcp/commit/353fd9998aa7020b8a5a814615f31ae275a4d075))
* **state:** add persistent state with master deployment password ([37110df](https://github.com/PrintrFi/printr-mcp/commit/37110df57d25a03521a50d48fe4b8d5a33178c61))


### Bug Fixes

* **fund-deployment-wallet:** always persist wallets to prevent fund loss ([7994696](https://github.com/PrintrFi/printr-mcp/commit/7994696219b350a6183e5a26275b8826d7f9c6c2))

## [0.9.0](https://github.com/PrintrFi/printr-mcp/compare/v0.8.1...v0.9.0) (2026-03-12)


### Features

* **cli:** add agent skill with interactive installer ([fd9e110](https://github.com/PrintrFi/printr-mcp/commit/fd9e110b44f767bcbb4ece48f8f8f17ae4b67444))

## [0.8.1](https://github.com/PrintrFi/printr-mcp/compare/v0.8.0...v0.8.1) (2026-03-12)


### Bug Fixes

* **svm:** detect signatureSubscribe method not found for WS fallback ([c7bd5de](https://github.com/PrintrFi/printr-mcp/commit/c7bd5de43f36cc64e7e7d5959b4ba349c4b36145))

## [0.8.0](https://github.com/PrintrFi/printr-mcp/compare/v0.7.0...v0.8.0) (2026-03-12)


### Features

* **lib:** add sleep utility function ([6bb6e8c](https://github.com/PrintrFi/printr-mcp/commit/6bb6e8c1acd2fd5decad2b7d68dc70cc3725215e))
* **svm:** add websocket-to-polling fallback for tx confirmation ([a4e1ee9](https://github.com/PrintrFi/printr-mcp/commit/a4e1ee90d79057b0e9dd2705e0e8e5e0b3503dad))
* **svm:** WebSocket-to-polling fallback for transaction confirmation ([5463518](https://github.com/PrintrFi/printr-mcp/commit/5463518b35ed88047a9dafecb1357e4fca9d8799))

## [0.7.0](https://github.com/PrintrFi/printr-mcp/compare/v0.6.0...v0.7.0) (2026-03-12)


### Features

* autonomous wallet funding from treasury ([93eb73b](https://github.com/PrintrFi/printr-mcp/commit/93eb73bc1f830e75399536b29619670cbcf986f1))
* **caip:** add parseCaip2 and chainTypeFromCaip2 utilities ([83fa8fd](https://github.com/PrintrFi/printr-mcp/commit/83fa8fdf5619229257b3b95507a999c198c57dc6))
* **mcp:** register treasury and deployment wallet tools ([70cf65d](https://github.com/PrintrFi/printr-mcp/commit/70cf65d63d0bd73a09b2afa474311a4ef1a6e059))
* **tools:** add printr_drain_deployment_wallet tool ([ab894ee](https://github.com/PrintrFi/printr-mcp/commit/ab894eea664f52cdc7a0e60461bf1604277230ae))
* **tools:** add printr_fund_deployment_wallet tool ([4f5901e](https://github.com/PrintrFi/printr-mcp/commit/4f5901e1b6f0b6fe7c5b35adf01dd080316daad6))
* **tools:** add printr_set_treasury_wallet tool ([7a4d431](https://github.com/PrintrFi/printr-mcp/commit/7a4d431ccd38f40f58665e1985e6a51807c248c7))
* **treasury:** add treasury wallet utilities ([cf3cc25](https://github.com/PrintrFi/printr-mcp/commit/cf3cc25156fe7a701d61ef0440193105e200ec9c))

## [0.6.0](https://github.com/PrintrFi/printr-mcp/compare/v0.5.0...v0.6.0) (2026-03-11)


### Features

* **chains:** add getRpcUrl with Alchemy and custom RPC support ([5adbe1f](https://github.com/PrintrFi/printr-mcp/commit/5adbe1f115b5fdd40d1c6d850325685bf6c79a04))
* custom RPC configuration with Alchemy support ([eba790a](https://github.com/PrintrFi/printr-mcp/commit/eba790a7011e064edc9627f6fcf57c02bcfad168))
* **env:** add RPC_URLS and ALCHEMY_API_KEY config ([1398f29](https://github.com/PrintrFi/printr-mcp/commit/1398f292b379535e721bdcd46be750b9688b6fef))

## [0.5.0](https://github.com/PrintrFi/printr-mcp/compare/v0.4.2...v0.5.0) (2026-03-04)


### Features

* add utility tools + enable zero buy ([4bf18d9](https://github.com/PrintrFi/printr-mcp/commit/4bf18d995ce462c2a71fb7290f6a9cd6752a307e))
* **lib:** add balance fetching utilities ([3686d79](https://github.com/PrintrFi/printr-mcp/commit/3686d793f6f6ff4b064aa909d3379d6beb55edb1))
* **lib:** add CAIP-10 parsing utilities ([869cd32](https://github.com/PrintrFi/printr-mcp/commit/869cd32e9672f424bdeaf62012e6f5f460b8f7c1))
* **lib:** add native transfer utilities ([c4b057c](https://github.com/PrintrFi/printr-mcp/commit/c4b057c944f3ba6b37eef83af03c3fa2c7e6f4ca))
* **tools:** add printr_get_balance tool ([f786755](https://github.com/PrintrFi/printr-mcp/commit/f786755663b996894cf0029e35d5565e71748f7a))
* **tools:** add printr_get_token_balance tool ([ad67ad8](https://github.com/PrintrFi/printr-mcp/commit/ad67ad8711c24e0293008e146b013394cf11516a))
* **tools:** add printr_supported_chains tool ([b854a1f](https://github.com/PrintrFi/printr-mcp/commit/b854a1f1da08bad75eae531807214ab2aec15d78))
* **tools:** add printr_transfer tool ([8223c80](https://github.com/PrintrFi/printr-mcp/commit/8223c808a86f233cff002dc5aaaebaa9199b01e1))


### Bug Fixes

* **schemas:** allow zero initial buy for token launch ([d724e67](https://github.com/PrintrFi/printr-mcp/commit/d724e67a5fc604f1fce1b696421bc52ca739fb94))

## [0.4.2](https://github.com/PrintrFi/printr-mcp/compare/v0.4.1...v0.4.2) (2026-03-03)


### Bug Fixes

* correct RPC endpoints for Monad, HyperEVM, and MegaETH ([0f6b05b](https://github.com/PrintrFi/printr-mcp/commit/0f6b05b93b8a92744fea669d63a1fa0d9bcb5677))
* correct RPC endpoints for Monad, HyperEVM, and MegaETH ([d6ce3fd](https://github.com/PrintrFi/printr-mcp/commit/d6ce3fd67dcbc822bd8a699b018b06df14764b91))

## [0.4.1](https://github.com/PrintrFi/printr-mcp/compare/v0.4.0...v0.4.1) (2026-03-02)


### Bug Fixes

* correct mcpName case to match GitHub org ([f9a371c](https://github.com/PrintrFi/printr-mcp/commit/f9a371c6ca46a5cec7d8c83ab7f61b47dd88fffd))

## [0.4.0](https://github.com/PrintrFi/printr-mcp/compare/v0.3.3...v0.4.0) (2026-03-02)


### Features

* **lib:** add ensureHex utility for base64/hex normalization ([af4a1f4](https://github.com/PrintrFi/printr-mcp/commit/af4a1f45c4cdbdd7f5ab7b07557a11c35010dc84))
* MCP registry support and hex normalization ([61de503](https://github.com/PrintrFi/printr-mcp/commit/61de5033c4c2ee6f23fd36ec83c39d6025284a1f))
* **wallet:** add bulk remove tool for keystore cleanup ([673aefe](https://github.com/PrintrFi/printr-mcp/commit/673aefeebab2041fa1324e0161d8c5d4607fccb1))

## [0.3.3](https://github.com/PrintrFi/printr-mcp/compare/v0.3.2...v0.3.3) (2026-02-25)


### Bug Fixes

* trigger 0.3.3 release ([63f3581](https://github.com/PrintrFi/printr-mcp/commit/63f35815ae0abf31c34a166cd55e957a431cd818))

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
