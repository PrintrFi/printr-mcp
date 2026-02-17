# Test Coverage Improvement Plan

**Status**: Draft
**Last Updated**: 2026-02-18
**Current Coverage**: ~17% (1 of 6 files tested)

## Executive Summary

The codebase has basic utility function tests but lacks coverage for core business logic (MCP tools, schema validation, API integration). This document outlines a pragmatic plan to achieve meaningful test coverage without over-engineering.

## Current State

### What's Tested ✅

**File**: `src/client.spec.ts` (83 lines, 7 tests)

| Function | Coverage | Value |
|----------|----------|-------|
| `unwrapResult` | 100% | High - All branches tested |
| `toToolResponse` | 100% | High - Success/error paths |
| `createPrintrClient` | Partial | Low - Only checks instantiation |

**Strengths**:
- Error handling thoroughly tested
- Response formatting covered
- No flaky tests

**Weaknesses**:
- No actual HTTP/API testing
- Core MCP tools untested
- Schema validation untested

### Coverage Gaps ❌

| File | Lines | Risk | Priority |
|------|-------|------|----------|
| `src/schemas.ts` | 97 | **HIGH** | 🔴 P0 |
| `src/tools/create-token.ts` | 92 | **HIGH** | 🔴 P0 |
| `src/tools/quote.ts` | 42 | **MEDIUM** | 🟡 P1 |
| `src/tools/get-token.ts` | 62 | **MEDIUM** | 🟡 P1 |
| `src/tools/get-deployments.ts` | 63 | **MEDIUM** | 🟡 P1 |
| `src/index.ts` | 39 | **LOW** | 🟢 P2 |

**Total untested**: 395 lines (83% of codebase)

## Risk Analysis

### High Risk: Schema Validation

**Why it matters**: Zod schemas define the API contract. Invalid data could:
- Pass to API causing 400 errors
- Break MCP clients expecting specific formats
- Violate OpenAPI spec

**Current exposure**:
```typescript
// No tests verify these work correctly
export const initialBuy = z.object({...}).refine(...)
export const graduationThreshold = z.union([z.literal(69000), z.literal(250000)])
export const caip2ChainId = z.string().describe(...)
```

### High Risk: MCP Tool Logic

**Why it matters**: Tools are the primary interface. Bugs here affect all users.

**Current exposure**:
- Tool registration not verified
- Input/output transformation untested
- Error handling paths not exercised

## Recommended Test Strategy

### Phase 1: Critical Path (P0) 🔴

**Goal**: Cover high-risk, high-value code paths
**Timeline**: 1-2 days
**Target Coverage**: 40-50%

#### 1.1 Schema Validation Tests

**File**: `src/schemas.spec.ts`

```typescript
import { describe, it, expect } from "bun:test";
import {
  caip2ChainId,
  caip10Address,
  initialBuy,
  graduationThreshold,
  externalLinks,
} from "./schemas.js";

describe("caip2ChainId", () => {
  it("accepts valid EVM chain IDs", () => {
    const result = caip2ChainId.safeParse("eip155:8453");
    expect(result.success).toBe(true);
  });

  it("accepts valid Solana chain IDs", () => {
    const result = caip2ChainId.safeParse(
      "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
    );
    expect(result.success).toBe(true);
  });

  it("rejects invalid format", () => {
    const result = caip2ChainId.safeParse("invalid");
    expect(result.success).toBe(false);
  });
});

describe("initialBuy", () => {
  it("accepts supply_percent only", () => {
    const result = initialBuy.safeParse({ supply_percent: 10 });
    expect(result.success).toBe(true);
  });

  it("accepts spend_usd only", () => {
    const result = initialBuy.safeParse({ spend_usd: 100 });
    expect(result.success).toBe(true);
  });

  it("rejects multiple fields", () => {
    const result = initialBuy.safeParse({
      supply_percent: 10,
      spend_usd: 100,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("Exactly one");
  });

  it("rejects supply_percent out of range", () => {
    expect(initialBuy.safeParse({ supply_percent: 0 }).success).toBe(false);
    expect(initialBuy.safeParse({ supply_percent: 70 }).success).toBe(false);
  });
});

describe("graduationThreshold", () => {
  it("accepts valid thresholds", () => {
    expect(graduationThreshold.safeParse(69000).success).toBe(true);
    expect(graduationThreshold.safeParse(250000).success).toBe(true);
  });

  it("rejects invalid thresholds", () => {
    expect(graduationThreshold.safeParse(100000).success).toBe(false);
  });

  it("accepts undefined (optional)", () => {
    expect(graduationThreshold.safeParse(undefined).success).toBe(true);
  });
});

describe("externalLinks", () => {
  it("accepts valid URLs", () => {
    const result = externalLinks.safeParse({
      website: "https://example.com",
      x: "https://x.com/handle",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid URLs", () => {
    const result = externalLinks.safeParse({ website: "not-a-url" });
    expect(result.success).toBe(false);
  });
});
```

**Expected Tests**: 15-20
**Lines Covered**: ~97 (schemas.ts)

#### 1.2 Tool Integration Tests

**File**: `src/tools/quote.spec.ts`

```typescript
import { describe, it, expect, mock } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerQuoteTool } from "./quote.js";
import type { PrintrClient } from "../client.js";

describe("registerQuoteTool", () => {
  it("registers tool with correct name and schema", () => {
    const mockClient = {} as PrintrClient;
    const server = new McpServer({ name: "test", version: "1.0.0" });

    registerQuoteTool(server, mockClient);

    const tools = server.listTools();
    expect(tools.some(t => t.name === "printr_quote")).toBe(true);
  });

  it("validates input parameters", async () => {
    const mockClient = {
      POST: mock(() =>
        Promise.resolve({
          data: { quote: { id: "q1", total: { cost_usd: 1.5 } } },
          error: undefined,
          response: new Response(),
        })
      ),
    } as unknown as PrintrClient;

    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerQuoteTool(server, mockClient);

    const tool = server.listTools().find(t => t.name === "printr_quote");
    const handler = tool?.handler;

    const result = await handler?.({
      chains: ["eip155:8453"],
      initial_buy: { spend_usd: 50 },
    });

    expect(mockClient.POST).toHaveBeenCalledWith("/print/quote", {
      body: expect.objectContaining({
        chains: ["eip155:8453"],
        initial_buy: { spend_usd: 50 },
      }),
    });
  });
});
```

**Expected Tests**: 8-10 per tool
**Lines Covered**: ~250 (all tools)

### Phase 2: Integration Coverage (P1) 🟡

**Goal**: Verify tools work with real MCP server
**Timeline**: 2-3 days
**Target Coverage**: 60-70%

#### 2.1 MCP Server Integration

**File**: `src/index.spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

describe("MCP Server", () => {
  it("registers all tools", async () => {
    // Test server initialization
    // Verify all 4 tools are registered
  });

  it("handles tool invocation end-to-end", async () => {
    // Test actual tool call through MCP protocol
  });
});
```

**Expected Tests**: 5-8
**Lines Covered**: ~39 (index.ts)

### Phase 3: Edge Cases (P2) 🟢

**Goal**: Harden against edge cases and errors
**Timeline**: 1-2 days
**Target Coverage**: 80%+

- Network errors
- Malformed API responses
- Rate limiting
- Timeout handling

## Success Metrics

| Metric | Current | Phase 1 | Phase 2 | Phase 3 |
|--------|---------|---------|---------|---------|
| **Files Tested** | 1/6 (17%) | 3/6 (50%) | 5/6 (83%) | 6/6 (100%) |
| **Line Coverage** | ~15% | ~45% | ~65% | ~80% |
| **Critical Paths** | 0% | 100% | 100% | 100% |
| **Confidence Level** | Low | Medium | High | Very High |

## Implementation Notes

### Testing Philosophy

1. **Pragmatic over Perfect**: Focus on high-value tests, not 100% coverage
2. **Fast Feedback**: All tests should run in <5 seconds
3. **No Flakiness**: Avoid mocks when possible, use simple test data
4. **Maintainable**: Tests should be easy to update when code changes

### When to Use Different Test Types

| Test Type | Use When | Example |
|-----------|----------|---------|
| **Unit** | Testing pure functions | Schema validation, error handling |
| **Integration** | Testing component interaction | Tool + MCP server |
| **Contract** | Testing API compatibility | OpenAPI spec validation |
| **E2E** | Testing full workflows | Actual API calls (CI only) |

### Anti-Patterns to Avoid

❌ **Don't**: Mock everything
✅ **Do**: Use real objects when possible

❌ **Don't**: Test implementation details
✅ **Do**: Test observable behavior

❌ **Don't**: Write brittle snapshot tests
✅ **Do**: Assert specific values

## Maintenance Strategy

### Keeping Tests Updated

1. **CI Enforcement**: PR must not decrease coverage
2. **Review Checklist**: "Did you add tests?"
3. **Quarterly Review**: Remove obsolete tests
4. **Documentation**: Keep this doc updated

### When to Skip Tests

It's OK to skip tests for:
- Generated code (`api.gen.d.ts`)
- Simple type definitions
- Obvious glue code

## Next Steps

1. **Immediate**: Implement Phase 1 schema tests
2. **This Week**: Add quote tool tests
3. **Next Week**: Complete Phase 1
4. **Review**: Assess value before Phase 2

## Questions & Discussion

**Q: Why not use coverage tools like c8/nyc?**
A: Bun test doesn't have built-in coverage yet. Manual tracking is sufficient for now.

**Q: Should we test private functions?**
A: No. Test through public API. If private function needs testing, it should be public.

**Q: What about snapshot tests?**
A: Avoid. They're brittle and don't catch semantic bugs. Use explicit assertions.

---

**Document Owner**: Engineering Team
**Review Cycle**: Quarterly
**Last Review**: 2026-02-18
