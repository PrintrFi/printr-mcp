import { describe, expect, it } from "bun:test";
import { erc20Abi, http, parseAbi } from "viem";
import { mainnet } from "viem/chains";
import { PublicContractClient } from "./public-contract-client.js";

const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;
const HOLDER = "0x55FE002aefF02F77364de339a1292923A15844B8" as const;

describe("PublicContractClient", () => {
  it("stores address and abi on construction", () => {
    const client = new PublicContractClient({
      address: USDC,
      abi: erc20Abi,
      chain: mainnet,
      transport: http("https://example.com"),
    });
    expect(client.address).toBe(USDC);
    expect(client.abi).toBe(erc20Abi);
  });

  it("read() returns Promises typed per ABI function", () => {
    const client = new PublicContractClient({
      address: USDC,
      abi: erc20Abi,
      chain: mainnet,
      transport: http("https://example.com"),
    });

    // Type-only assertions: these annotations enforce return-type narrowing
    // against the ABI. The Promises are intentionally not awaited — viem
    // retries internally and would make the test slow and flaky.
    const decimals: Promise<number> = client.read({ functionName: "decimals" });
    const balance: Promise<bigint> = client.read({
      functionName: "balanceOf",
      args: [HOLDER],
    });
    const symbol: Promise<string> = client.read({ functionName: "symbol" });

    expect(decimals).toBeInstanceOf(Promise);
    expect(balance).toBeInstanceOf(Promise);
    expect(symbol).toBeInstanceOf(Promise);

    // Swallow the inevitable network rejection so it doesn't surface as
    // an unhandled rejection in the test runner.
    decimals.catch(() => {});
    balance.catch(() => {});
    symbol.catch(() => {});
  });

  it("works with a custom human-readable ABI", () => {
    const customAbi = parseAbi([
      "function owner() view returns (address)",
      "function tokenURI(uint256 id) view returns (string)",
    ]);

    const client = new PublicContractClient({
      address: USDC,
      abi: customAbi,
      chain: mainnet,
      transport: http("https://example.com"),
    });

    const owner: Promise<`0x${string}`> = client.read({ functionName: "owner" });
    const uri: Promise<string> = client.read({
      functionName: "tokenURI",
      args: [0n],
    });

    expect(owner).toBeInstanceOf(Promise);
    expect(uri).toBeInstanceOf(Promise);

    owner.catch(() => {});
    uri.catch(() => {});
  });
});
