import { describe, expect, test } from "bun:test";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { err, okAsync } from "neverthrow";
import {
  buildEvmContractCallArgs,
  fakeSigner,
  localSigner,
  onchainosChainId,
  onchainosSigner,
  parseAddressFromOutput,
  parseEvmSubmit,
  selectSigner,
} from "./index.js";
import type { OnchainosExec } from "./onchainos-signer.js";

const EVM_CAIP2 = "eip155:8453";
const SVM_CAIP2 = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
const WETH_CAIP10 = "eip155:8453:0x4200000000000000000000000000000000000006";

// Canonical anvil/hardhat account 0 — deterministic, public test key.
const ANVIL_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const ANVIL_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

const evmPayload = { to: WETH_CAIP10, calldata: "0xd0e30db0", value: "1000", gas_limit: 100_000 };
const svmPayload = {
  ixs: [{ program_id: "p", accounts: [], data: "AA==" }],
  mint_address: SVM_CAIP2,
};

describe("fakeSigner", () => {
  test("returns deterministic defaults", async () => {
    const signer = fakeSigner();
    expect((await signer.resolveAddress(EVM_CAIP2))._unsafeUnwrap()).toBe(
      "0x0000000000000000000000000000000000000001",
    );
    expect((await signer.signAndSubmitEvm(evmPayload))._unsafeUnwrap().status).toBe("success");
    expect((await signer.signAndSubmitSvm(svmPayload))._unsafeUnwrap().confirmation_status).toBe(
      "confirmed",
    );
  });

  test("surfaces configured errors", async () => {
    const signer = fakeSigner({
      evm: err({ kind: "tx_reverted", tx_hash: "0xabc", block_number: "9" }),
    });
    expect((await signer.signAndSubmitEvm(evmPayload))._unsafeUnwrapErr().kind).toBe("tx_reverted");
  });
});

describe("localSigner", () => {
  test("derives the EVM address from the key", async () => {
    const signer = localSigner(ANVIL_KEY, "evm");
    expect((await signer.resolveAddress(EVM_CAIP2))._unsafeUnwrap()).toBe(ANVIL_ADDRESS);
  });

  test("derives the SVM address from the key", async () => {
    const kp = Keypair.fromSeed(new Uint8Array(32).fill(7));
    const signer = localSigner(bs58.encode(kp.secretKey), "svm");
    expect((await signer.resolveAddress(SVM_CAIP2))._unsafeUnwrap()).toBe(kp.publicKey.toBase58());
  });

  test("rejects a chain of the wrong type", async () => {
    const signer = localSigner(ANVIL_KEY, "evm");
    expect((await signer.resolveAddress(SVM_CAIP2))._unsafeUnwrapErr().kind).toBe(
      "unsupported_chain",
    );
  });

  test("an EVM signer refuses to sign SVM", async () => {
    const signer = localSigner(ANVIL_KEY, "evm");
    expect((await signer.signAndSubmitSvm(svmPayload))._unsafeUnwrapErr().kind).toBe(
      "signing_failed",
    );
  });
});

describe("onchainosChainId", () => {
  test.each([
    { caip2: "eip155:8453", expected: 8453 },
    { caip2: "eip155:1", expected: 1 },
    { caip2: SVM_CAIP2, expected: 501 },
    { caip2: "cosmos:hub", expected: null },
    { caip2: "eip155:notanumber", expected: null },
  ])("$caip2 -> $expected", ({ caip2, expected }) => {
    expect(onchainosChainId(caip2)).toBe(expected);
  });
});

describe("buildEvmContractCallArgs", () => {
  test("includes --amt for non-zero value and ends with --force", () => {
    const args = buildEvmContractCallArgs({
      chainId: 8453,
      to: "0xabc",
      calldata: "0xdead",
      value: "1000",
      strategy: "printr",
      bizType: "dapp",
    });
    expect(args).toEqual([
      "wallet",
      "contract-call",
      "--biz-type",
      "dapp",
      "--strategy",
      "printr",
      "--chain",
      "8453",
      "--to",
      "0xabc",
      "--input-data",
      "0xdead",
      "--amt",
      "1000",
      "--force",
    ]);
  });

  test("omits --amt when value is zero", () => {
    const args = buildEvmContractCallArgs({
      chainId: 1,
      to: "0xabc",
      calldata: "0xdead",
      value: "0",
      strategy: "printr",
      bizType: "dapp",
    });
    expect(args).not.toContain("--amt");
  });
});

describe("parseAddressFromOutput", () => {
  test.each([
    { json: '{"data":{"address":"0xAA"}}', expected: "0xAA" },
    { json: '{"data":{"details":[{"tokenAssets":[{"address":"0xBB"}]}]}}', expected: "0xBB" },
    { json: "not json", expected: null },
  ])("parses $expected", ({ json, expected }) => {
    expect(parseAddressFromOutput(json)).toBe(expected);
  });
});

describe("parseEvmSubmit", () => {
  test("ok when txHash present", () => {
    const r = parseEvmSubmit('{"data":{"txHash":"0xfeed","blockNumber":"42"}}');
    expect(r._unsafeUnwrap()).toEqual({ tx_hash: "0xfeed", block_number: "42", status: "success" });
  });

  test("err when txHash missing", () => {
    expect(parseEvmSubmit('{"data":{}}')._unsafeUnwrapErr().kind).toBe("broadcast_failed");
  });
});

describe("onchainosSigner", () => {
  const recordingExec = (stdout: string) => {
    const calls: string[][] = [];
    const exec: OnchainosExec = (args) => {
      calls.push([...args]);
      return okAsync(stdout);
    };
    return { exec, calls };
  };

  test("signAndSubmitEvm builds the call and parses the hash", async () => {
    const { exec, calls } = recordingExec('{"data":{"txHash":"0xc0ffee","blockNumber":"7"}}');
    const signer = onchainosSigner({ exec, strategy: "printr" });
    const result = await signer.signAndSubmitEvm(evmPayload);
    expect(result._unsafeUnwrap().tx_hash).toBe("0xc0ffee");
    expect(calls[0]).toContain("contract-call");
    expect(calls[0]).toContain("0x4200000000000000000000000000000000000006");
  });

  test("resolveAddress queries onchainos for the chain", async () => {
    const { exec, calls } = recordingExec('{"data":{"address":"0xWALLET"}}');
    const signer = onchainosSigner({ exec, strategy: "printr" });
    expect((await signer.resolveAddress(EVM_CAIP2))._unsafeUnwrap()).toBe("0xWALLET");
    expect(calls[0]).toEqual(["wallet", "addresses", "--chain", "8453"]);
  });

  test("SVM signing is not yet implemented", async () => {
    const { exec } = recordingExec("{}");
    const signer = onchainosSigner({ exec, strategy: "printr" });
    expect((await signer.signAndSubmitSvm(svmPayload))._unsafeUnwrapErr().kind).toBe(
      "signing_failed",
    );
  });
});

describe("selectSigner", () => {
  test("builds a local signer", () => {
    const r = selectSigner({ kind: "local", privateKey: ANVIL_KEY, chainType: "evm" });
    expect(r._unsafeUnwrap().kind).toBe("local");
  });

  test("builds a fake signer", () => {
    expect(selectSigner({ kind: "fake" })._unsafeUnwrap().kind).toBe("fake");
  });

  test("onchainos requires deps", () => {
    expect(selectSigner({ kind: "onchainos" })._unsafeUnwrapErr().kind).toBe("resolution_failed");
    const withDeps = selectSigner(
      { kind: "onchainos" },
      { onchainos: { exec: () => okAsync("{}"), strategy: "printr" } },
    );
    expect(withDeps._unsafeUnwrap().kind).toBe("onchainos");
  });
});
