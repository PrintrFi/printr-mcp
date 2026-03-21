# Changelog

## [0.13.0](https://github.com/PrintrFi/printr-mcp/compare/mcp-v0.12.2...mcp-v0.13.0) (2026-03-21)


### Features

* **mcp:** active wallet integration, strict TS/lint uplift, and fee tools refactor ([425f981](https://github.com/PrintrFi/printr-mcp/commit/425f981edef5c2bcc6066c816c0e4584626e43d7))
* **mcp:** integrate active wallet and auto-drain into printr_launch_token ([ac7c052](https://github.com/PrintrFi/printr-mcp/commit/ac7c0527ebe9f61847e0f95733ddd3eae4c59e15))


### Bug Fixes

* address PR review issues in drain, launch-token, and sdk ([21afd38](https://github.com/PrintrFi/printr-mcp/commit/21afd3809c6ced8498e57b280ab9db71a22f09ee))
* **mcp:** address Copilot review issues in launch-token ([146989d](https://github.com/PrintrFi/printr-mcp/commit/146989dd7a8b24aa48212b690287677dbdf82da9))
* resolve strict TS and biome violations across all packages ([f394977](https://github.com/PrintrFi/printr-mcp/commit/f3949775746a91b51c82d84d4482b42cd251020a))
* token deploy success logic ([a6bbf4e](https://github.com/PrintrFi/printr-mcp/commit/a6bbf4e374938a25addbab08327a7784a8a9f5a9))

## [0.12.2](https://github.com/PrintrFi/printr-mcp/compare/mcp-v0.12.1...mcp-v0.12.2) (2026-03-18)


### Bug Fixes

* **mcp:** release workflow ([f6d3825](https://github.com/PrintrFi/printr-mcp/commit/f6d3825e66a8f09b1db98edaa3b813832b335f8c))
* **mcp:** remove prepublishOnly script and fix CI publish workflow ([29aae4f](https://github.com/PrintrFi/printr-mcp/commit/29aae4fa7e3805411e81dd1f96e17e4fe229bdc0))

## [0.12.1](https://github.com/PrintrFi/printr-mcp/compare/mcp-v0.12.0...mcp-v0.12.1) (2026-03-18)


### Bug Fixes

* add npm keywords for package discoverability ([af55b2c](https://github.com/PrintrFi/printr-mcp/commit/af55b2c97bfe7403352ab8534f485b36f041f549))
* add shared tsconfig.base.json to reduce duplication ([aadb43b](https://github.com/PrintrFi/printr-mcp/commit/aadb43b833ee430505ebfe1f0a7f22c7f13339a4))
* **mcp:** convert build script from sh to ts for consistency ([e304fb5](https://github.com/PrintrFi/printr-mcp/commit/e304fb5851ba0215e0ccf524597373c9bc0fbd52))
* streamline build config and trigger patch release ([dcc04b1](https://github.com/PrintrFi/printr-mcp/commit/dcc04b1a163f3f082c24e0eaa85205c2e4df50b3))

## [0.12.0](https://github.com/PrintrFi/printr-mcp/compare/mcp-v0.11.0...mcp-v0.12.0) (2026-03-18)


### Features

* add package READMEs and security improvements ([583b469](https://github.com/PrintrFi/printr-mcp/commit/583b469a1a9153e653896930de38e0a262b8c091))
* add package READMEs, security improvements, and CI workflow fixes ([caee5d8](https://github.com/PrintrFi/printr-mcp/commit/caee5d8e9365e3836e547122bdc6d4476b0ba64f))
* extract CLI into separate @printr/cli package ([f46be4a](https://github.com/PrintrFi/printr-mcp/commit/f46be4ac73d9dee857279400645f0ffdf4bd77b1))
* implement production-ready structured logging with pino ([ef8134a](https://github.com/PrintrFi/printr-mcp/commit/ef8134a7e8775cfd13add9719ab8c09801160e70))
* **mcp:** apply logToolExecution to all remaining MCP tools ([511747d](https://github.com/PrintrFi/printr-mcp/commit/511747daad60bd93b9918cfe84e3c19b89b053ad))
* split into @printr/sdk, @printr/mcp, and @printr/cli packages ([229fe17](https://github.com/PrintrFi/printr-mcp/commit/229fe17f3f8acbbcdf22cef62ce0836a31373eed))
* split mcp and sdk packages ([8638a3f](https://github.com/PrintrFi/printr-mcp/commit/8638a3f0cf0ad711378118c886b0e2789f9ef17f))


### Bug Fixes

* address Copilot PR review feedback ([98d7958](https://github.com/PrintrFi/printr-mcp/commit/98d7958a18650d5924fb63100b19f5dcc25a5a48))
* **ci:** improve release-please workflow efficiency ([2949505](https://github.com/PrintrFi/printr-mcp/commit/2949505c1a318e338701857a0e8c5b02eb249b89))
* enable TypeScript declaration generation ([894c91f](https://github.com/PrintrFi/printr-mcp/commit/894c91f573ae2817b41848ae6d716c5aa81a89ce))
* **mcp:** add @types/react to devDependencies ([91bd5fc](https://github.com/PrintrFi/printr-mcp/commit/91bd5fcd1bbfeee1d1d1e7febf5d0bcdf13d257d))
* **mcp:** add SDK peer dependencies directly to MCP package ([8246631](https://github.com/PrintrFi/printr-mcp/commit/8246631b4a45a4ed2855be3f3aa7e92888d6ee10))
* **mcp:** add sharp as direct dependency ([f95aee4](https://github.com/PrintrFi/printr-mcp/commit/f95aee4e52e5226deb25da41085d195ed2bec6c1))
* **mcp:** make fund-deployment-wallet test accept keystore error in CI ([13b003a](https://github.com/PrintrFi/printr-mcp/commit/13b003ab58c69fce01eefa1f0edc2e31c9a3cb79))
* **mcp:** set temp wallet store in fund-deployment-wallet test for CI ([ce02e54](https://github.com/PrintrFi/printr-mcp/commit/ce02e54a7a2c55ba3f12880e5507b874d2e66fbd))
* support both sync and async handlers in logToolExecution ([73c3f2b](https://github.com/PrintrFi/printr-mcp/commit/73c3f2b6bde7f635df0ee1773f7b76e8b683ef36))
* trigger 0.3.1 patch release ([601dda4](https://github.com/PrintrFi/printr-mcp/commit/601dda4d1988f0a7f685bd57e3c270a859e5c1b7))
* trigger 0.3.3 release ([63f3581](https://github.com/PrintrFi/printr-mcp/commit/63f35815ae0abf31c34a166cd55e957a431cd818))
