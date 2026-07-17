# Changelog

## [0.9.0](https://github.com/PrintrFi/printr-mcp/compare/sdk-v0.8.0...sdk-v0.9.0) (2026-07-17)


### Features

* **sdk:** add normalizeTokenId + CAIP token-id regex exports ([1488567](https://github.com/PrintrFi/printr-mcp/commit/148856766f5e6ac3c2d13387bfe4579100562268))
* **sdk:** add Robinhood chain support (eip155:4663) ([14874ad](https://github.com/PrintrFi/printr-mcp/commit/14874ad52ab39a7663d3a91354ac9ece90c380af))
* **sdk:** add Robinhood chain support (eip155:4663) ([807273c](https://github.com/PrintrFi/printr-mcp/commit/807273ca015658a34aff4a97bf9c1de18671198e))
* **sdk:** normalizeTokenId + CAIP token-id regex exports ([01165b8](https://github.com/PrintrFi/printr-mcp/commit/01165b8af2524a220b36da77451079eb2f0a0a4a))


### Bug Fixes

* **sdk:** align chain registry with printr web ([2c4df28](https://github.com/PrintrFi/printr-mcp/commit/2c4df2814cfdc22d24a83c6dcdbfdfb335519ad9))

## [0.8.0](https://github.com/PrintrFi/printr-mcp/compare/sdk-v0.7.0...sdk-v0.8.0) (2026-06-20)


### Features

* **docs:** scaffold Fumadocs documentation site ([02c96c7](https://github.com/PrintrFi/printr-mcp/commit/02c96c73f775254cbf457240a769fce4e04fd469))
* **sdk:** make client apiKey optional ([c1073d1](https://github.com/PrintrFi/printr-mcp/commit/c1073d159f7f1854cfa1c575f1f332f8b689ffeb))
* **sdk:** make client apiKey optional ([f378371](https://github.com/PrintrFi/printr-mcp/commit/f3783716a64cd1a0a95523664c862d7add0b8e7b))

## [0.7.0](https://github.com/PrintrFi/printr-mcp/compare/sdk-v0.6.1...sdk-v0.7.0) (2026-06-02)


### Features

* **sdk:** add fetch-only balance-lite variant ([813adbf](https://github.com/PrintrFi/printr-mcp/commit/813adbf83c579f6301b5b7572b65f95b3df39f36))
* **sdk:** add Result-returning tryParse variants for throwing parsers ([50095e0](https://github.com/PrintrFi/printr-mcp/commit/50095e08d70f020624acdf0f3aaf3be0fce5a360))
* **sdk:** add types-only @printr/sdk/openapi entry ([e31405a](https://github.com/PrintrFi/printr-mcp/commit/e31405ac9facae9981525010d47cbbce535f2bf3))
* **sdk:** createStateRepo factory + cover state with specs ([6077ea3](https://github.com/PrintrFi/printr-mcp/commit/6077ea34811e3b7f166d2a8910c0526ac4bdbeb3))
* **sdk:** epic A — make SDK Workers-ready ([1cde7cc](https://github.com/PrintrFi/printr-mcp/commit/1cde7cc1a92cf9294f8537c237a8e5c8270f9203))
* **sdk:** generic PublicContractClient&lt;TAbi&gt; wrapper ([0fd5cf0](https://github.com/PrintrFi/printr-mcp/commit/0fd5cf0136a0224923d11f2de28c485c9cf5c742))
* **sdk:** namespaced tx and balance facade ([075fb35](https://github.com/PrintrFi/printr-mcp/commit/075fb35c1599aba86cc36f9fb411ae86b96e89aa))
* **sdk:** namespaced tx and balance facade ([cadeb90](https://github.com/PrintrFi/printr-mcp/commit/cadeb90d3ff03558f7c8a192e251b51d1fa118ac)), closes [#81](https://github.com/PrintrFi/printr-mcp/issues/81)
* **sdk:** rpc fallback across multiple endpoints in signers ([674a921](https://github.com/PrintrFi/printr-mcp/commit/674a921fad901335d3f009e4ab1302423fb6f714))
* **sdk:** rpc fallback across multiple endpoints in signers ([6b579da](https://github.com/PrintrFi/printr-mcp/commit/6b579dae08f22272200568da2820bd0ff9ed78a9)), closes [#79](https://github.com/PrintrFi/printr-mcp/issues/79)
* **signing:** pluggable signer adapters + enforced lint gates ([87fbd07](https://github.com/PrintrFi/printr-mcp/commit/87fbd0709a5712226b1c9741a791aba55a04e45f))


### Bug Fixes

* **sdk:** balance-lite dispatcher + symbol() fallback ([6295954](https://github.com/PrintrFi/printr-mcp/commit/6295954b02cae39ac96a0f3450f701f4d040850c))
* **sdk:** broadcast at most once when rpc fallback retries ([2b31f0d](https://github.com/PrintrFi/printr-mcp/commit/2b31f0d54eb2a7564b6caff03f031611421def3e))
* **sdk:** catch sync throws in signers + type tx_hash as Hex ([b8a8f63](https://github.com/PrintrFi/printr-mcp/commit/b8a8f63d9cfa2d44417eb8bf16b0de8932844fc1))
* **sdk:** drop createRequire shim from dist bundle ([16fb08a](https://github.com/PrintrFi/printr-mcp/commit/16fb08ada6b9d5a25a602ee4561255b50a3a72cc))
* **sdk:** include api.gen.d.ts in dist ([7a227de](https://github.com/PrintrFi/printr-mcp/commit/7a227de5027da4f3cdd6c64bff5e5c486c6cff17))
* **sdk:** lazy-load sharp + node:fs in image.ts ([09e8f4d](https://github.com/PrintrFi/printr-mcp/commit/09e8f4db705770768984e397577ba5de92aa1b24))
* **sdk:** never overwrite an unreadable keystore with an empty one ([97d8a12](https://github.com/PrintrFi/printr-mcp/commit/97d8a12629c036617b07db65bc67e737bce02371))
* **sdk:** read PRINTR_WALLET_STORE live so keystore tests stay isolated ([5671e85](https://github.com/PrintrFi/printr-mcp/commit/5671e85ff3840c36d79e0bc22b589712f1422b12))
* **sdk:** validate token chain in balance.token.get + clarify test comment ([393b1dc](https://github.com/PrintrFi/printr-mcp/commit/393b1dc5a485e47884cd51d03a47f16abdf39ab7))

## [0.6.1](https://github.com/PrintrFi/printr-mcp/compare/sdk-v0.6.0...sdk-v0.6.1) (2026-05-18)


### Bug Fixes

* **deps:** pin zod to ~4.3.6 for MCP SDK 1.29 compat ([23ab19f](https://github.com/PrintrFi/printr-mcp/commit/23ab19f7730a27403e32fcbcb5b2ac52772294a4))

## [0.6.0](https://github.com/PrintrFi/printr-mcp/compare/sdk-v0.5.0...sdk-v0.6.0) (2026-05-11)


### Features

* **sdk,mcp:** add printr_create_stake_position tool ([663b381](https://github.com/PrintrFi/printr-mcp/commit/663b3815dc11ffb4af6fe07fb366cc801adf82ab))
* **sdk,mcp:** add printr_create_stake_position tool ([2607cae](https://github.com/PrintrFi/printr-mcp/commit/2607cae9094c5a0e78a42527567adc8cff900684))

## [0.5.0](https://github.com/PrintrFi/printr-mcp/compare/sdk-v0.4.0...sdk-v0.5.0) (2026-05-11)


### Features

* add fungible token transfer (SPL + ERC20) ([3f670e7](https://github.com/PrintrFi/printr-mcp/commit/3f670e7f06a757d1fac6f7d232da933e635cfe91))
* **sdk,mcp:** require CAIP-10 token IDs for token transfer ([4b8c6d3](https://github.com/PrintrFi/printr-mcp/commit/4b8c6d387c3779ef997839a6ed93ce4e33fe1a3a)), closes [#58](https://github.com/PrintrFi/printr-mcp/issues/58)
* **sdk:** add SPL and ERC20 token transfer functions ([e693191](https://github.com/PrintrFi/printr-mcp/commit/e6931917777ffa037c67b8b2107a2d946b150c3b))


### Bug Fixes

* **sdk,mcp:** address copilot review on token transfer ([fdaea12](https://github.com/PrintrFi/printr-mcp/commit/fdaea1230593d7a604a11bf99fdd5480dbb8dbcd))

## [0.4.0](https://github.com/PrintrFi/printr-mcp/compare/sdk-v0.3.1...sdk-v0.4.0) (2026-04-21)


### Features

* **sdk,mcp:** add fee_sink support for staking token creation ([0bdf712](https://github.com/PrintrFi/printr-mcp/commit/0bdf71263f2dea657c93c2b374f09e07616b9129))
* **sdk,mcp:** add fee_sink support for staking token creation ([dc5bd19](https://github.com/PrintrFi/printr-mcp/commit/dc5bd193207d0272578edba292173663afa8f797))
* **sdk:** add staking API client for positions and reward claims ([b6b2bc6](https://github.com/PrintrFi/printr-mcp/commit/b6b2bc60613d550b59848925968faa6a94f47a52))
* staking positions and claim rewards MCP tools ([167a428](https://github.com/PrintrFi/printr-mcp/commit/167a428c309cedccd99ca6bd60c6711370b11e6a))


### Bug Fixes

* **sdk:** use publicnode for avalanche rpc ([dce21e5](https://github.com/PrintrFi/printr-mcp/commit/dce21e5bc67c9a4146908c45f04ac71105d59a66))

## [0.3.1](https://github.com/PrintrFi/printr-mcp/compare/sdk-v0.3.0...sdk-v0.3.1) (2026-04-08)


### Bug Fixes

* **sdk:** sanitise HTML error responses from Printr API ([d41bbce](https://github.com/PrintrFi/printr-mcp/commit/d41bbceceb60755249ae45856134db74cc04b150))
* **sdk:** sanitise HTML error responses from Printr API ([0724aac](https://github.com/PrintrFi/printr-mcp/commit/0724aac0444afb9607be4b0c61dbd7d09268abb7))

## [0.3.0](https://github.com/PrintrFi/printr-mcp/compare/sdk-v0.2.1...sdk-v0.3.0) (2026-03-21)


### Features

* **mcp:** active wallet integration, strict TS/lint uplift, and fee tools refactor ([425f981](https://github.com/PrintrFi/printr-mcp/commit/425f981edef5c2bcc6066c816c0e4584626e43d7))
* **sdk:** add getEvmConfig chain resolver to chains module ([daab17a](https://github.com/PrintrFi/printr-mcp/commit/daab17a242a94901b76403d6a6327c4ec67323bf))
* **sdk:** make creator_accounts optional in BuildTokenInput ([af08b89](https://github.com/PrintrFi/printr-mcp/commit/af08b89ae91ab9f8db1072cc7dd4dfd2a6a7db64))


### Bug Fixes

* address PR review issues in drain, launch-token, and sdk ([21afd38](https://github.com/PrintrFi/printr-mcp/commit/21afd3809c6ced8498e57b280ab9db71a22f09ee))
* **mcp:** address Copilot review issues in launch-token ([146989d](https://github.com/PrintrFi/printr-mcp/commit/146989dd7a8b24aa48212b690287677dbdf82da9))
* resolve strict TS and biome violations across all packages ([f394977](https://github.com/PrintrFi/printr-mcp/commit/f3949775746a91b51c82d84d4482b42cd251020a))
* **sdk:** parseCaip10 returns null instead of throwing ([329d9c1](https://github.com/PrintrFi/printr-mcp/commit/329d9c1dbc768518ed57933b94d93c4d0ea452fb))
* **sdk:** use cover fit and improve prompt requirements for token avatars ([34f0b6f](https://github.com/PrintrFi/printr-mcp/commit/34f0b6f26ea7bffef40a86c9f931b7fc8fef2366))

## [0.2.1](https://github.com/PrintrFi/printr-mcp/compare/sdk-v0.2.0...sdk-v0.2.1) (2026-03-18)


### Bug Fixes

* add npm keywords for package discoverability ([af55b2c](https://github.com/PrintrFi/printr-mcp/commit/af55b2c97bfe7403352ab8534f485b36f041f549))
* add shared tsconfig.base.json to reduce duplication ([aadb43b](https://github.com/PrintrFi/printr-mcp/commit/aadb43b833ee430505ebfe1f0a7f22c7f13339a4))
* **sdk:** remove unused path aliases from tsconfig ([534197b](https://github.com/PrintrFi/printr-mcp/commit/534197b5d262eb7efe5f5099d84223e0c36cf329))
* streamline build config and trigger patch release ([dcc04b1](https://github.com/PrintrFi/printr-mcp/commit/dcc04b1a163f3f082c24e0eaa85205c2e4df50b3))

## [0.2.0](https://github.com/PrintrFi/printr-mcp/compare/sdk-v0.1.0...sdk-v0.2.0) (2026-03-18)


### Features

* add package READMEs and security improvements ([583b469](https://github.com/PrintrFi/printr-mcp/commit/583b469a1a9153e653896930de38e0a262b8c091))
* add package READMEs, security improvements, and CI workflow fixes ([caee5d8](https://github.com/PrintrFi/printr-mcp/commit/caee5d8e9365e3836e547122bdc6d4476b0ba64f))
* implement production-ready structured logging with pino ([ef8134a](https://github.com/PrintrFi/printr-mcp/commit/ef8134a7e8775cfd13add9719ab8c09801160e70))
* split into @printr/sdk, @printr/mcp, and @printr/cli packages ([229fe17](https://github.com/PrintrFi/printr-mcp/commit/229fe17f3f8acbbcdf22cef62ce0836a31373eed))
* split mcp and sdk packages ([8638a3f](https://github.com/PrintrFi/printr-mcp/commit/8638a3f0cf0ad711378118c886b0e2789f9ef17f))


### Bug Fixes

* address Copilot PR review feedback ([98d7958](https://github.com/PrintrFi/printr-mcp/commit/98d7958a18650d5924fb63100b19f5dcc25a5a48))
* **ci:** improve release-please workflow efficiency ([2949505](https://github.com/PrintrFi/printr-mcp/commit/2949505c1a318e338701857a0e8c5b02eb249b89))
* enable TypeScript declaration generation ([894c91f](https://github.com/PrintrFi/printr-mcp/commit/894c91f573ae2817b41848ae6d716c5aa81a89ce))
* **sdk:** build all entry points and externalize sharp ([6f14d25](https://github.com/PrintrFi/printr-mcp/commit/6f14d25eb255458f75920e41647605a9b7255719))
* trigger 0.3.1 patch release ([601dda4](https://github.com/PrintrFi/printr-mcp/commit/601dda4d1988f0a7f685bd57e3c270a859e5c1b7))
* trigger 0.3.3 release ([63f3581](https://github.com/PrintrFi/printr-mcp/commit/63f35815ae0abf31c34a166cd55e957a431cd818))
