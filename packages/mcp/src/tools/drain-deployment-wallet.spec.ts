import { describe, expect, it, test } from "bun:test";
import { err, errAsync, ok, okAsync } from "neverthrow";
import { BASE_META, createMockServer, SOL_META } from "../lib/test-helpers.js";
import {
  type DrainDeploymentWalletDeps,
  drainDeploymentWalletHandler,
  registerDrainDeploymentWalletTool,
} from "./drain-deployment-wallet.js";

describe("printr_drain_deployment_wallet", () => {
  const setup = () => {
    const server = createMockServer();
    registerDrainDeploymentWalletTool(server as any);
    return server.getRegisteredTool()!;
  };

  test("registers tool with correct name", () => {
    const tool = setup();
    expect(tool.name).toBe("printr_drain_deployment_wallet");
  });

  test("has required input schema fields", () => {
    const tool = setup();
    const schema = tool.config.inputSchema as { shape: Record<string, unknown> };
    expect(schema.shape).toHaveProperty("chain");
    expect(schema.shape).toHaveProperty("keep_minimum");
  });

  test("has required output schema fields", () => {
    const tool = setup();
    const schema = tool.config.outputSchema as { shape: Record<string, unknown> };
    expect(schema.shape).toHaveProperty("drained_amount");
    expect(schema.shape).toHaveProperty("drained_atomic");
    expect(schema.shape).toHaveProperty("symbol");
    expect(schema.shape).toHaveProperty("from_address");
    expect(schema.shape).toHaveProperty("to_address");
    expect(schema.shape).toHaveProperty("remaining_balance");
  });

  test.each([
    {
      input: { chain: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" },
      error: "No active SVM deployment wallet",
      description: "no active SVM wallet",
    },
    {
      input: { chain: "eip155:8453" },
      error: "No active EVM deployment wallet",
      description: "no active EVM wallet",
    },
  ])("rejects when $description", async ({ input, error }) => {
    const result = await setup().handler(input);
    expect((result as any)?.isError).toBe(true);
    expect((result as any)?.content?.[0]?.text).toContain(error);
  });
});

// ---------------------------------------------------------------------------
// drainDeploymentWalletHandler — full handler with stubbed deps
// ---------------------------------------------------------------------------

const FAKE_WALLET = {
  privateKey: "wallet-priv",
  address: "WalletAddr",
  walletId: "wallet-uuid-1",
};

const DRAIN_RESULT_SVM = {
  drained_amount: "0.1",
  drained_atomic: "100000000",
  symbol: "SOL",
  from_address: "WalletAddr",
  to_address: "TreasuryAddr",
  tx_signature: "5K3sig",
  remaining_balance: "0",
  wallet_id: "wallet-uuid-1",
};

const DRAIN_RESULT_EVM = {
  drained_amount: "0.5",
  drained_atomic: "500000000000000000",
  symbol: "ETH",
  from_address: "0xfrom",
  to_address: "0xtreasury",
  tx_hash: "0xabc",
  remaining_balance: "0",
  wallet_id: "wallet-uuid-1",
};

type DepsRecord = {
  resolveWallet: { args: unknown[] }[];
  getTreasuryKeyOrError: { args: unknown[] }[];
  getChainMeta: { args: unknown[] }[];
  getEvmConfig: { args: unknown[] }[];
  drainSvm: { args: unknown[] }[];
  drainEvm: { args: unknown[] }[];
};

function emptyRecord(): DepsRecord {
  return {
    resolveWallet: [],
    getTreasuryKeyOrError: [],
    getChainMeta: [],
    getEvmConfig: [],
    drainSvm: [],
    drainEvm: [],
  };
}

function makeDeps(
  record: DepsRecord,
  overrides: Partial<DrainDeploymentWalletDeps> = {},
): DrainDeploymentWalletDeps {
  return {
    resolveWallet: (...args: Parameters<DrainDeploymentWalletDeps["resolveWallet"]>) => {
      record.resolveWallet.push({ args });
      return ok(FAKE_WALLET);
    },
    getTreasuryKeyOrError: (
      ...args: Parameters<DrainDeploymentWalletDeps["getTreasuryKeyOrError"]>
    ) => {
      record.getTreasuryKeyOrError.push({ args });
      return { key: "treasury-key" };
    },
    getChainMeta: ((...args: [string]) => {
      record.getChainMeta.push({ args });
      const [chain] = args;
      return chain.startsWith("solana:") ? SOL_META : BASE_META;
    }) as DrainDeploymentWalletDeps["getChainMeta"],
    getEvmConfig: (...args: Parameters<DrainDeploymentWalletDeps["getEvmConfig"]>) => {
      record.getEvmConfig.push({ args });
      return { chainId: 8453, rpc: "https://evm.test" };
    },
    drainSvm: (...args: Parameters<DrainDeploymentWalletDeps["drainSvm"]>) => {
      record.drainSvm.push({ args });
      return okAsync(DRAIN_RESULT_SVM);
    },
    drainEvm: (...args: Parameters<DrainDeploymentWalletDeps["drainEvm"]>) => {
      record.drainEvm.push({ args });
      return okAsync(DRAIN_RESULT_EVM);
    },
    ...overrides,
  };
}

const SOLANA_INPUT = {
  chain: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  keep_minimum: "0",
};

const BASE_INPUT = {
  chain: "eip155:8453",
  keep_minimum: "0",
};

describe("drainDeploymentWalletHandler — SVM dispatch", () => {
  it("dispatches to drainSvm with the resolved wallet + parsed keep_minimum", async () => {
    const record = emptyRecord();
    const deps = makeDeps(record);

    const result = await drainDeploymentWalletHandler({
      input: { ...SOLANA_INPUT, keep_minimum: "0.05" },
      deps,
    });

    expect(record.drainSvm).toHaveLength(1);
    expect(record.drainEvm).toHaveLength(0);
    expect(record.getEvmConfig).toHaveLength(0);
    const [walletArg, treasuryArg, keepArg, metaArg] = record.drainSvm[0]?.args ?? [];
    expect(walletArg).toBe(FAKE_WALLET);
    expect(treasuryArg).toBe("treasury-key");
    expect(keepArg).toBe(0.05);
    expect(metaArg).toBe(SOL_META);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().tx_signature).toBe("5K3sig");
  });
});

describe("drainDeploymentWalletHandler — EVM dispatch", () => {
  it("dispatches to drainEvm with chainId + rpc from getEvmConfig", async () => {
    const record = emptyRecord();
    const deps = makeDeps(record);

    const result = await drainDeploymentWalletHandler({
      input: { ...BASE_INPUT, keep_minimum: "0.01" },
      deps,
    });

    expect(record.drainEvm).toHaveLength(1);
    expect(record.drainSvm).toHaveLength(0);
    expect(record.getEvmConfig).toHaveLength(1);
    const [walletArg, treasuryArg, keepArg, metaArg, chainIdArg, rpcArg] =
      record.drainEvm[0]?.args ?? [];
    expect(walletArg).toBe(FAKE_WALLET);
    expect(treasuryArg).toBe("treasury-key");
    // keep_minimum stays a string for EVM (bigint-safe parsing downstream).
    expect(keepArg).toBe("0.01");
    expect(metaArg).toBe(BASE_META);
    expect(chainIdArg).toBe(8453);
    expect(rpcArg).toBe("https://evm.test");
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().tx_hash).toBe("0xabc");
  });

  it("surfaces getEvmConfig's error without calling drainEvm", async () => {
    const record = emptyRecord();
    const deps = makeDeps(record, {
      getEvmConfig: (...args: Parameters<DrainDeploymentWalletDeps["getEvmConfig"]>) => {
        record.getEvmConfig.push({ args });
        return { error: "No RPC configured for eip155:8453" };
      },
    });

    const result = await drainDeploymentWalletHandler({ input: BASE_INPUT, deps });

    expect(record.drainEvm).toHaveLength(0);
    expect(result.isErr()).toBe(true);
  });
});

describe("drainDeploymentWalletHandler — pre-drain gates", () => {
  it("short-circuits when resolveWallet fails (no treasury / drain calls)", async () => {
    const record = emptyRecord();
    const deps = makeDeps(record, {
      resolveWallet: (...args: Parameters<DrainDeploymentWalletDeps["resolveWallet"]>) => {
        record.resolveWallet.push({ args });
        return err({ message: "No active SVM deployment wallet found." });
      },
    });

    const result = await drainDeploymentWalletHandler({ input: SOLANA_INPUT, deps });

    expect(record.getTreasuryKeyOrError).toHaveLength(0);
    expect(record.drainSvm).toHaveLength(0);
    expect(result.isErr()).toBe(true);
  });

  it("surfaces the treasury error without calling drainSvm / drainEvm", async () => {
    const record = emptyRecord();
    const deps = makeDeps(record, {
      getTreasuryKeyOrError: (
        ...args: Parameters<DrainDeploymentWalletDeps["getTreasuryKeyOrError"]>
      ) => {
        record.getTreasuryKeyOrError.push({ args });
        return { error: "Treasury wallet not configured for SVM." };
      },
    });

    const result = await drainDeploymentWalletHandler({ input: SOLANA_INPUT, deps });

    expect(record.drainSvm).toHaveLength(0);
    expect(result.isErr()).toBe(true);
  });

  it("surfaces an 'Unsupported chain' error when getChainMeta returns undefined", async () => {
    const record = emptyRecord();
    const deps = makeDeps(record, {
      getChainMeta: ((...args: [string]) => {
        record.getChainMeta.push({ args });
        return undefined;
      }) as DrainDeploymentWalletDeps["getChainMeta"],
    });

    const result = await drainDeploymentWalletHandler({ input: SOLANA_INPUT, deps });

    expect(record.drainSvm).toHaveLength(0);
    expect(result.isErr()).toBe(true);
  });

  it("surfaces drainSvm's error verbatim", async () => {
    const record = emptyRecord();
    const deps = makeDeps(record, {
      drainSvm: (...args: Parameters<DrainDeploymentWalletDeps["drainSvm"]>) => {
        record.drainSvm.push({ args });
        return errAsync({ message: "Insufficient SOL for fees" });
      },
    });

    const result = await drainDeploymentWalletHandler({ input: SOLANA_INPUT, deps });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toMatch(/Insufficient SOL/);
  });
});

describe("drainDeploymentWalletHandler — wallet_id passthrough", () => {
  it("passes an explicit wallet_id to resolveWallet (priority 1 branch)", async () => {
    const record = emptyRecord();
    const deps = makeDeps(record);

    await drainDeploymentWalletHandler({
      input: { ...SOLANA_INPUT, wallet_id: "explicit-uuid" },
      deps,
    });

    expect(record.resolveWallet[0]?.args).toEqual(["svm", "explicit-uuid"]);
  });

  it("passes undefined when no wallet_id is supplied (priorities 2-4 dispatch inside resolveWallet)", async () => {
    const record = emptyRecord();
    const deps = makeDeps(record);

    await drainDeploymentWalletHandler({ input: SOLANA_INPUT, deps });

    expect(record.resolveWallet[0]?.args).toEqual(["svm", undefined]);
  });
});
