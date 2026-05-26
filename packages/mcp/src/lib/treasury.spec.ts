import { afterEach, describe, expect, it } from "bun:test";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { type ActiveWallet, treasuryWallets } from "~/server/wallet-sessions.js";
import { env } from "./env.js";
import {
  getTreasuryAddress,
  getTreasuryErrorMsg,
  getTreasuryKey,
  getTreasuryKeyOrError,
} from "./treasury.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEvmWallet(): ActiveWallet {
  const privateKey = generatePrivateKey();
  const address = privateKeyToAccount(privateKey).address;
  return { privateKey, address };
}

function makeSvmWallet(): ActiveWallet {
  const kp = Keypair.generate();
  return { privateKey: bs58.encode(kp.secretKey), address: kp.publicKey.toBase58() };
}

afterEach(() => {
  // Always restore module-level state so tests don't bleed.
  treasuryWallets.clear();
});

// ---------------------------------------------------------------------------
// getTreasuryKey
// ---------------------------------------------------------------------------

describe("getTreasuryKey", () => {
  it("returns the session-treasury key when one is set for the chain (priority 1)", () => {
    const wallet = makeEvmWallet();
    treasuryWallets.set("evm", wallet);
    expect(getTreasuryKey("evm")).toBe(wallet.privateKey);
  });

  it("scopes session-treasury lookups by chain type", () => {
    const evm = makeEvmWallet();
    const svm = makeSvmWallet();
    treasuryWallets.set("evm", evm);
    treasuryWallets.set("svm", svm);
    expect(getTreasuryKey("evm")).toBe(evm.privateKey);
    expect(getTreasuryKey("svm")).toBe(svm.privateKey);
  });

  it("falls through to env when no session-treasury is set (priority 2)", () => {
    // Tautological by design — the assertion locks the priority dispatch
    // contract. If the dispatch ever stops reading from env (e.g. drops to
    // hardcoded defaults), this test breaks even though the env value
    // itself didn't change.
    expect(getTreasuryKey("evm")).toBe(env.EVM_WALLET_PRIVATE_KEY);
    expect(getTreasuryKey("svm")).toBe(env.SVM_WALLET_PRIVATE_KEY);
  });
});

// ---------------------------------------------------------------------------
// getTreasuryErrorMsg
// ---------------------------------------------------------------------------

describe("getTreasuryErrorMsg", () => {
  it("names the EVM env var for `evm` chain type", () => {
    const msg = getTreasuryErrorMsg("evm");
    expect(msg).toMatch(/EVM_WALLET_PRIVATE_KEY/);
    expect(msg).toMatch(/printr_set_treasury_wallet/);
    expect(msg).not.toMatch(/SVM_WALLET_PRIVATE_KEY/);
  });

  it("names the SVM env var for `svm` chain type", () => {
    const msg = getTreasuryErrorMsg("svm");
    expect(msg).toMatch(/SVM_WALLET_PRIVATE_KEY/);
    expect(msg).toMatch(/printr_set_treasury_wallet/);
    expect(msg).not.toMatch(/EVM_WALLET_PRIVATE_KEY/);
  });
});

// ---------------------------------------------------------------------------
// getTreasuryKeyOrError
// ---------------------------------------------------------------------------

describe("getTreasuryKeyOrError", () => {
  it("returns { key } when a session-treasury is configured", () => {
    const wallet = makeEvmWallet();
    treasuryWallets.set("evm", wallet);
    const result = getTreasuryKeyOrError("evm");
    expect("key" in result).toBe(true);
    if ("key" in result) {
      expect(result.key).toBe(wallet.privateKey);
    }
  });

  it("returns { error } when no key is available", () => {
    // Force-clear the session map; the env-fallback path may or may not yield
    // a key depending on the runner's env. Skip the assertion shape when env
    // happens to populate (still exercises the function — no crash).
    treasuryWallets.clear();
    const result = getTreasuryKeyOrError("evm");
    if (env.EVM_WALLET_PRIVATE_KEY) {
      expect("key" in result).toBe(true);
    } else {
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toMatch(/Treasury wallet not configured/);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// getTreasuryAddress
// ---------------------------------------------------------------------------

describe("getTreasuryAddress", () => {
  it("derives the EVM address from the configured private key", () => {
    const wallet = makeEvmWallet();
    treasuryWallets.set("evm", wallet);
    expect(getTreasuryAddress("evm")).toBe(wallet.address);
  });

  it("derives the SVM address from the configured private key", () => {
    const wallet = makeSvmWallet();
    treasuryWallets.set("svm", wallet);
    expect(getTreasuryAddress("svm")).toBe(wallet.address);
  });

  it("returns undefined when no key is available and env is not set", () => {
    // Only meaningful when env-fallback is also empty — guard so the test
    // doesn't false-positive in dev shells that export the key.
    if (env.EVM_WALLET_PRIVATE_KEY) {
      return;
    }
    expect(getTreasuryAddress("evm")).toBeUndefined();
  });
});
