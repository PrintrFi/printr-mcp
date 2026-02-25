import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const STORE = join(tmpdir(), `printr-keystore-test-${Date.now()}.json`);

beforeAll(() => {
  process.env.PRINTR_WALLET_STORE = STORE;
});

afterAll(() => {
  rmSync(STORE, { force: true });
});

// Lazily re-import after env var is set
async function ks() {
  return import("./keystore.js");
}

function makeSvmKeypair() {
  const kp = Keypair.generate();
  return { privateKey: bs58.encode(kp.secretKey), address: kp.publicKey.toBase58() };
}

function makeEvmKeypair() {
  const privateKey = generatePrivateKey();
  const address = privateKeyToAccount(privateKey).address;
  return { privateKey, address };
}

describe("encryptKey / decryptKey", () => {
  it("round-trips an SVM private key", async () => {
    const { encryptKey, decryptKey, addWallet, getWallet } = await ks();
    const { privateKey, address } = makeSvmKeypair();
    const id = randomUUID();

    addWallet({
      id,
      label: "svm-test",
      chain: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
      address,
      createdAt: Date.now(),
      ...encryptKey(privateKey, "pass1"),
    });

    const entry = getWallet(id);
    expect(entry).toBeDefined();

    const result = decryptKey(entry!, "pass1");
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(privateKey);
  });

  it("round-trips an EVM private key", async () => {
    const { encryptKey, decryptKey, addWallet, getWallet } = await ks();
    const { privateKey, address } = makeEvmKeypair();
    const id = randomUUID();

    addWallet({
      id,
      label: "evm-test",
      chain: "eip155:8453",
      address,
      createdAt: Date.now(),
      ...encryptKey(privateKey, "pass2"),
    });

    const entry = getWallet(id);
    const result = decryptKey(entry!, "pass2");
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(privateKey);
  });

  it("returns err for a wrong password", async () => {
    const { encryptKey, decryptKey, addWallet, getWallet } = await ks();
    const { privateKey, address } = makeSvmKeypair();
    const id = randomUUID();

    addWallet({
      id,
      label: "wrong-pass-test",
      chain: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
      address,
      createdAt: Date.now(),
      ...encryptKey(privateKey, "correct"),
    });

    const entry = getWallet(id);
    const result = decryptKey(entry!, "incorrect");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBe("wrong_password");
  });
});

describe("listWallets", () => {
  it("returns all wallets when no chain filter given", async () => {
    const { encryptKey, addWallet, listWallets } = await ks();
    const before = listWallets().length;

    const { privateKey: pk1, address: a1 } = makeSvmKeypair();
    const { privateKey: pk2, address: a2 } = makeEvmKeypair();

    addWallet({
      id: randomUUID(),
      label: "l1",
      chain: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
      address: a1,
      createdAt: Date.now(),
      ...encryptKey(pk1, "p"),
    });
    addWallet({
      id: randomUUID(),
      label: "l2",
      chain: "eip155:8453",
      address: a2,
      createdAt: Date.now(),
      ...encryptKey(pk2, "p"),
    });

    expect(listWallets().length).toBe(before + 2);
  });

  it("filters by chain", async () => {
    const { listWallets } = await ks();
    const solana = listWallets("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp");
    const evm = listWallets("eip155:8453");
    expect(solana.every((w) => w.chain === "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")).toBe(true);
    expect(evm.every((w) => w.chain === "eip155:8453")).toBe(true);
  });
});

describe("removeWallet", () => {
  it("removes an existing wallet and returns true", async () => {
    const { encryptKey, addWallet, getWallet, removeWallet } = await ks();
    const { privateKey, address } = makeSvmKeypair();
    const id = randomUUID();

    addWallet({
      id,
      label: "rm-test",
      chain: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
      address,
      createdAt: Date.now(),
      ...encryptKey(privateKey, "p"),
    });
    expect(getWallet(id)).toBeDefined();

    expect(removeWallet(id)).toBe(true);
    expect(getWallet(id)).toBeUndefined();
  });

  it("returns false for an unknown id", async () => {
    const { removeWallet } = await ks();
    expect(removeWallet(randomUUID())).toBe(false);
  });
});
