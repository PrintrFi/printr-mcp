import { describe, expect, it, test } from "bun:test";
import type { ChainType } from "@printr/sdk";
import { err, errAsync, ok, okAsync } from "neverthrow";
import { createMockServer, SOL_META } from "../lib/test-helpers.js";
import type { ActiveWallet } from "../server/wallet-sessions.js";
import {
  buildTxField,
  type FundDeploymentWalletDeps,
  fundDeploymentWalletHandler,
  generateWallet,
  registerFundDeploymentWalletTool,
} from "./fund-deployment-wallet.js";

describe("printr_fund_deployment_wallet", () => {
  const setup = () => {
    const server = createMockServer();
    registerFundDeploymentWalletTool(server as any);
    return server.getRegisteredTool()!;
  };

  test("registers tool with correct name", () => {
    const tool = setup();
    expect(tool.name).toBe("printr_fund_deployment_wallet");
  });

  test("has required input schema fields", () => {
    const tool = setup();
    const schema = tool.config.inputSchema as { shape: Record<string, unknown> };
    expect(schema.shape).toHaveProperty("chain");
    expect(schema.shape).toHaveProperty("amount");
  });

  test("does not have label or password input fields (uses master password)", () => {
    const tool = setup();
    const schema = tool.config.inputSchema as { shape: Record<string, unknown> };
    expect(schema.shape).not.toHaveProperty("label");
    expect(schema.shape).not.toHaveProperty("password");
  });

  test("has required output schema fields", () => {
    const tool = setup();
    const schema = tool.config.outputSchema as { shape: Record<string, unknown> };
    expect(schema.shape).toHaveProperty("address");
    expect(schema.shape).toHaveProperty("chain");
    expect(schema.shape).toHaveProperty("chain_name");
    expect(schema.shape).toHaveProperty("amount_funded");
    expect(schema.shape).toHaveProperty("amount_atomic");
    expect(schema.shape).toHaveProperty("symbol");
    expect(schema.shape).toHaveProperty("wallet_id");
  });

  test("does not have generated_password output field (uses master password)", () => {
    const tool = setup();
    const schema = tool.config.outputSchema as { shape: Record<string, unknown> };
    expect(schema.shape).not.toHaveProperty("generated_password");
  });

  test("wallet_id is a required output field (not optional)", () => {
    const tool = setup();
    const schema = tool.config.outputSchema as {
      shape: Record<string, { isOptional: () => boolean }>;
    };
    expect(schema.shape.wallet_id.isOptional()).toBe(false);
  });

  test("rejects when PRINTR_DEPLOYMENT_PASSWORD is not set or keystore is not writable", async () => {
    const result = await setup().handler({
      chain: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
      amount: "0.1",
    });
    expect((result as any)?.isError).toBe(true);
    const errorText = (result as any)?.content?.[0]?.text;
    // Accept either error: missing password or directory not writable (CI environment)
    const isExpectedError =
      errorText.includes("PRINTR_DEPLOYMENT_PASSWORD") ||
      errorText.includes("Keystore directory not writable");
    expect(isExpectedError).toBe(true);
  });

  test("rejects invalid chain format", async () => {
    const result = await setup().handler({
      chain: "invalid-chain",
      amount: "0.1",
    });
    expect((result as any)?.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildTxField — pure helper
// ---------------------------------------------------------------------------

describe("buildTxField", () => {
  it("emits only `tx_signature` for an SVM result", () => {
    const out = buildTxField({ type: "svm", signature: "5K3..." });
    expect(out).toEqual({ tx_signature: "5K3..." });
    expect("tx_hash" in out).toBe(false);
  });

  it("emits only `tx_hash` for an EVM result", () => {
    const out = buildTxField({ type: "evm", tx_hash: "0xabc" });
    expect(out).toEqual({ tx_hash: "0xabc" });
    expect("tx_signature" in out).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// generateWallet — pure helper
// ---------------------------------------------------------------------------

describe("generateWallet", () => {
  it("returns a Solana keypair shape for `svm`", () => {
    const wallet = generateWallet("svm");
    expect(wallet.privateKey).toBeString();
    expect(wallet.address).toBeString();
    // Solana addresses are base58-encoded 32 bytes — 32 to 44 chars in the alphabet.
    expect(wallet.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    // Secret key is 64 bytes base58 → around 87–88 chars; loose bound to avoid flake.
    expect(wallet.privateKey.length).toBeGreaterThan(80);
  });

  it("returns an EVM keypair shape for `evm`", () => {
    const wallet = generateWallet("evm");
    expect(wallet.privateKey).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(wallet.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("returns distinct keypairs on consecutive calls (no module-level caching)", () => {
    const a = generateWallet("evm");
    const b = generateWallet("evm");
    expect(a.privateKey).not.toBe(b.privateKey);
    expect(a.address).not.toBe(b.address);

    const c = generateWallet("svm");
    const d = generateWallet("svm");
    expect(c.privateKey).not.toBe(d.privateKey);
    expect(c.address).not.toBe(d.address);
  });
});

// ---------------------------------------------------------------------------
// fundDeploymentWalletHandler — full handler with stubbed deps
// ---------------------------------------------------------------------------

type DepsRecord = {
  verifyKeystoreWritable: { args: unknown[] }[];
  validateInputs: { args: unknown[] }[];
  persistWallet: { args: unknown[] }[];
  executeTransfer: { args: unknown[] }[];
  setActiveWalletId: { args: unknown[] }[];
  setLastDeploymentWalletId: { args: unknown[] }[];
};

function emptyRecord(): DepsRecord {
  return {
    verifyKeystoreWritable: [],
    validateInputs: [],
    persistWallet: [],
    executeTransfer: [],
    setActiveWalletId: [],
    setLastDeploymentWalletId: [],
  };
}

function makeDeps(
  record: DepsRecord,
  activeWallets: Map<ChainType, ActiveWallet>,
  overrides: Partial<FundDeploymentWalletDeps> = {},
): FundDeploymentWalletDeps {
  return {
    verifyKeystoreWritable: (
      ...args: Parameters<FundDeploymentWalletDeps["verifyKeystoreWritable"]>
    ) => {
      record.verifyKeystoreWritable.push({ args });
      return okAsync(undefined);
    },
    validateInputs: (...args: Parameters<FundDeploymentWalletDeps["validateInputs"]>) => {
      record.validateInputs.push({ args });
      return ok({
        type: "svm" as ChainType,
        treasuryKey: "treasury-key",
        meta: SOL_META,
        parsed: { namespace: "solana", chainRef: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" },
        masterPassword: "master-pass",
      });
    },
    persistWallet: (...args: Parameters<FundDeploymentWalletDeps["persistWallet"]>) => {
      record.persistWallet.push({ args });
      return ok({
        wallet_id: "wallet-uuid-1",
        privateKey: "new-wallet-priv",
        address: "NewWalletAddr",
      });
    },
    executeTransfer: (...args: Parameters<FundDeploymentWalletDeps["executeTransfer"]>) => {
      record.executeTransfer.push({ args });
      return okAsync({
        type: "svm" as const,
        signature: "5K3treasurySig",
        amount_atomic: "100000000",
      });
    },
    activeWallets,
    setActiveWalletId: (...args: Parameters<FundDeploymentWalletDeps["setActiveWalletId"]>) => {
      record.setActiveWalletId.push({ args });
      return ok(undefined);
    },
    setLastDeploymentWalletId: (
      ...args: Parameters<FundDeploymentWalletDeps["setLastDeploymentWalletId"]>
    ) => {
      record.setLastDeploymentWalletId.push({ args });
      return ok(undefined);
    },
    ...overrides,
  };
}

const baseInput = { chain: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", amount: "0.1" };

describe("fundDeploymentWalletHandler — happy path", () => {
  it("runs all five gated steps in order and surfaces the output shape", async () => {
    const record = emptyRecord();
    const activeWallets = new Map<ChainType, { privateKey: string; address: string }>();
    const deps = makeDeps(record, activeWallets);

    const result = await fundDeploymentWalletHandler({ input: baseInput, deps });

    expect(record.verifyKeystoreWritable).toHaveLength(1);
    expect(record.validateInputs).toHaveLength(1);
    expect(record.persistWallet).toHaveLength(1);
    expect(record.executeTransfer).toHaveLength(1);
    expect(record.setActiveWalletId).toHaveLength(1);
    expect(record.setLastDeploymentWalletId).toHaveLength(1);

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.address).toBe("NewWalletAddr");
    expect(value.chain_name).toBe("Solana");
    expect(value.symbol).toBe("SOL");
    expect(value.wallet_id).toBe("wallet-uuid-1");
    expect(value.amount_funded).toBe("0.1");
    expect(value.tx_signature).toBe("5K3treasurySig");
    expect("tx_hash" in value).toBe(false);

    expect(activeWallets.get("svm")).toEqual({
      privateKey: "new-wallet-priv",
      address: "NewWalletAddr",
    });
  });

  it("forwards the persisted wallet to executeTransfer (so funds go to the fresh address)", async () => {
    const record = emptyRecord();
    const deps = makeDeps(record, new Map());

    await fundDeploymentWalletHandler({ input: baseInput, deps });

    // args: (namespace, chainRef, recipientAddress, amount, treasuryKey, meta)
    expect(record.executeTransfer[0]?.args[2]).toBe("NewWalletAddr");
    expect(record.executeTransfer[0]?.args[3]).toBe("0.1");
    expect(record.executeTransfer[0]?.args[4]).toBe("treasury-key");
  });
});

describe("fundDeploymentWalletHandler — error short-circuits (fund-loss guards)", () => {
  it("aborts before persisting or transferring when the keystore is unwritable", async () => {
    const record = emptyRecord();
    const deps = makeDeps(record, new Map(), {
      verifyKeystoreWritable: () => errAsync({ message: "Keystore directory not writable" }),
    });

    const result = await fundDeploymentWalletHandler({ input: baseInput, deps });

    expect(record.validateInputs).toHaveLength(0);
    expect(record.persistWallet).toHaveLength(0);
    expect(record.executeTransfer).toHaveLength(0);
    expect(result.isErr()).toBe(true);
  });

  it("aborts before transferring when validateInputs fails", async () => {
    const record = emptyRecord();
    const deps = makeDeps(record, new Map(), {
      validateInputs: () => err({ message: "PRINTR_DEPLOYMENT_PASSWORD is required" }),
    });

    const result = await fundDeploymentWalletHandler({ input: baseInput, deps });

    expect(record.persistWallet).toHaveLength(0);
    expect(record.executeTransfer).toHaveLength(0);
    expect(result.isErr()).toBe(true);
  });

  it("aborts before transferring when persistWallet fails (so funds never leave treasury)", async () => {
    const record = emptyRecord();
    const deps = makeDeps(record, new Map(), {
      persistWallet: () =>
        err({
          message: "Failed to persist wallet to keystore: ENOSPC. Aborting to prevent fund loss.",
        }),
    });

    const result = await fundDeploymentWalletHandler({ input: baseInput, deps });

    expect(record.executeTransfer).toHaveLength(0);
    expect(record.setActiveWalletId).toHaveLength(0);
    expect(record.setLastDeploymentWalletId).toHaveLength(0);
    expect(result.isErr()).toBe(true);
  });
});

describe("fundDeploymentWalletHandler — best-effort state writes", () => {
  it("still surfaces a successful response even if setActiveWalletId fails (failures are logged, not propagated)", async () => {
    const record = emptyRecord();
    const deps = makeDeps(record, new Map(), {
      setActiveWalletId: (...args: Parameters<FundDeploymentWalletDeps["setActiveWalletId"]>) => {
        record.setActiveWalletId.push({ args });
        return err({ message: "EACCES" });
      },
    });

    const result = await fundDeploymentWalletHandler({ input: baseInput, deps });

    expect(record.executeTransfer).toHaveLength(1);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().wallet_id).toBe("wallet-uuid-1");
  });
});
