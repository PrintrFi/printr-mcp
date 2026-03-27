# Changelog

## [0.3.1](https://github.com/PrintrFi/printr-mcp/compare/cli-v0.3.0...cli-v0.3.1) (2026-03-26)


### Bug Fixes

* **cli:** add @types/node as direct devDep so types node resolves in CI ([2b37357](https://github.com/PrintrFi/printr-mcp/commit/2b37357092f18d26627d088b2366d2c5330df438))
* **cli:** include both node and bun types ([d070680](https://github.com/PrintrFi/printr-mcp/commit/d0706800ba220eb7d64bf422f3d14a8b5cc5c6ce))
* **cli:** use types node (cross-runtime Node/Bun compatible API surface) ([9106be2](https://github.com/PrintrFi/printr-mcp/commit/9106be2c551c5f6299a83636caa484aba646d277))
* **cli:** use types node instead of bun to avoid masking Bun-only APIs ([3a6aa72](https://github.com/PrintrFi/printr-mcp/commit/3a6aa72a1f7c828b99db110b71437f57f5aaf467))
* **mcp,cli:** silence baseUrl deprecation and fix env property access for TS 6.0 ([e8b2fd9](https://github.com/PrintrFi/printr-mcp/commit/e8b2fd96fd3edef3a450c8a1303325a78fe671db))

## [0.3.0](https://github.com/PrintrFi/printr-mcp/compare/cli-v0.2.1...cli-v0.3.0) (2026-03-21)


### Features

* **mcp:** active wallet integration, strict TS/lint uplift, and fee tools refactor ([425f981](https://github.com/PrintrFi/printr-mcp/commit/425f981edef5c2bcc6066c816c0e4584626e43d7))


### Bug Fixes

* resolve strict TS and biome violations across all packages ([f394977](https://github.com/PrintrFi/printr-mcp/commit/f3949775746a91b51c82d84d4482b42cd251020a))

## [0.2.1](https://github.com/PrintrFi/printr-mcp/compare/cli-v0.2.0...cli-v0.2.1) (2026-03-18)


### Bug Fixes

* add npm keywords for package discoverability ([af55b2c](https://github.com/PrintrFi/printr-mcp/commit/af55b2c97bfe7403352ab8534f485b36f041f549))
* add shared tsconfig.base.json to reduce duplication ([aadb43b](https://github.com/PrintrFi/printr-mcp/commit/aadb43b833ee430505ebfe1f0a7f22c7f13339a4))
* streamline build config and trigger patch release ([dcc04b1](https://github.com/PrintrFi/printr-mcp/commit/dcc04b1a163f3f082c24e0eaa85205c2e4df50b3))

## [0.2.0](https://github.com/PrintrFi/printr-mcp/compare/cli-v0.1.0...cli-v0.2.0) (2026-03-18)


### Features

* add package READMEs and security improvements ([583b469](https://github.com/PrintrFi/printr-mcp/commit/583b469a1a9153e653896930de38e0a262b8c091))
* add package READMEs, security improvements, and CI workflow fixes ([caee5d8](https://github.com/PrintrFi/printr-mcp/commit/caee5d8e9365e3836e547122bdc6d4476b0ba64f))
* extract CLI into separate @printr/cli package ([f46be4a](https://github.com/PrintrFi/printr-mcp/commit/f46be4ac73d9dee857279400645f0ffdf4bd77b1))
* split into @printr/sdk, @printr/mcp, and @printr/cli packages ([229fe17](https://github.com/PrintrFi/printr-mcp/commit/229fe17f3f8acbbcdf22cef62ce0836a31373eed))


### Bug Fixes

* **ci:** improve release-please workflow efficiency ([2949505](https://github.com/PrintrFi/printr-mcp/commit/2949505c1a318e338701857a0e8c5b02eb249b89))
* **cli:** remove invalid exit command from test script ([00217de](https://github.com/PrintrFi/printr-mcp/commit/00217de82c303400b67bcd81dbff5814b3f49f40))
* trigger 0.3.1 patch release ([601dda4](https://github.com/PrintrFi/printr-mcp/commit/601dda4d1988f0a7f685bd57e3c270a859e5c1b7))
* trigger 0.3.3 release ([63f3581](https://github.com/PrintrFi/printr-mcp/commit/63f35815ae0abf31c34a166cd55e957a431cd818))
