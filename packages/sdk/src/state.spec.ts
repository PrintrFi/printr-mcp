import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { createStateRepo, type StateRepo } from "./state.js";

// ---------------------------------------------------------------------------
// Per-test tmpfile fixture
// ---------------------------------------------------------------------------

let dir: string;
let path: string;
let repo: StateRepo;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "printr-state-"));
  path = join(dir, "state.json");
  repo = createStateRepo({ path });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Default-state fallback
// ---------------------------------------------------------------------------

describe("createStateRepo — default-state fallback", () => {
  it("returns default state when the file does not exist", () => {
    const state = repo.get();
    expect(state).toEqual({
      version: 1,
      activeWalletIds: {},
      treasuryWalletIds: {},
    });
  });

  it("returns default state when the file is unparseable", () => {
    writeFileSync(path, "not-json {[", "utf-8");
    expect(repo.get()).toEqual({
      version: 1,
      activeWalletIds: {},
      treasuryWalletIds: {},
    });
  });

  it("isolates each repo instance to its own path", () => {
    const otherPath = join(dir, "other.json");
    const otherRepo = createStateRepo({ path: otherPath });
    repo.setActiveWalletId("evm", "wallet-1");
    expect(repo.getActiveWalletId("evm")).toBe("wallet-1");
    expect(otherRepo.getActiveWalletId("evm")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Active wallet
// ---------------------------------------------------------------------------

describe("active wallet", () => {
  it("round-trips set → get", () => {
    expect(repo.getActiveWalletId("evm")).toBeUndefined();
    const setResult = repo.setActiveWalletId("evm", "wallet-evm-1");
    expect(setResult.isOk()).toBe(true);
    expect(repo.getActiveWalletId("evm")).toBe("wallet-evm-1");
  });

  it("scopes by chain type", () => {
    repo.setActiveWalletId("evm", "evm-1");
    repo.setActiveWalletId("svm", "svm-1");
    expect(repo.getActiveWalletId("evm")).toBe("evm-1");
    expect(repo.getActiveWalletId("svm")).toBe("svm-1");
  });

  it("clears an entry without touching the other chain type", () => {
    repo.setActiveWalletId("evm", "evm-1");
    repo.setActiveWalletId("svm", "svm-1");
    const clear = repo.clearActiveWalletId("evm");
    expect(clear.isOk()).toBe(true);
    expect(repo.getActiveWalletId("evm")).toBeUndefined();
    expect(repo.getActiveWalletId("svm")).toBe("svm-1");
  });
});

// ---------------------------------------------------------------------------
// Treasury wallet
// ---------------------------------------------------------------------------

describe("treasury wallet", () => {
  it("round-trips set → get scoped by chain type", () => {
    repo.setTreasuryWalletId("evm", "treasury-evm");
    repo.setTreasuryWalletId("svm", "treasury-svm");
    expect(repo.getTreasuryWalletId("evm")).toBe("treasury-evm");
    expect(repo.getTreasuryWalletId("svm")).toBe("treasury-svm");
  });
});

// ---------------------------------------------------------------------------
// Last deployment wallet
// ---------------------------------------------------------------------------

describe("last deployment wallet", () => {
  it("round-trips set → get → clear", () => {
    expect(repo.getLastDeploymentWalletId()).toBeUndefined();

    const setResult = repo.setLastDeploymentWalletId("dep-7");
    expect(setResult.isOk()).toBe(true);
    expect(repo.getLastDeploymentWalletId()).toBe("dep-7");

    const clearResult = repo.clearLastDeploymentWalletId();
    expect(clearResult.isOk()).toBe(true);
    expect(repo.getLastDeploymentWalletId()).toBeUndefined();
  });

  it("removes the optional field entirely from the persisted JSON when cleared", () => {
    repo.setLastDeploymentWalletId("dep-7");
    repo.clearLastDeploymentWalletId();
    const raw = z.record(z.string(), z.unknown()).parse(JSON.parse(readFileSync(path, "utf-8")));
    expect("lastDeploymentWalletId" in raw).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Atomic write
// ---------------------------------------------------------------------------

describe("atomic write", () => {
  it("leaves no `.tmp` sibling after a successful write", () => {
    repo.setActiveWalletId("evm", "wallet-1");

    let foundTmp = false;
    try {
      readFileSync(`${path}.tmp`, "utf-8");
      foundTmp = true;
    } catch {
      // ENOENT — exactly what we want.
    }
    expect(foundTmp).toBe(false);
  });

  it("creates the parent directory if missing", () => {
    const nested = join(dir, "nested/deep/state.json");
    const nestedRepo = createStateRepo({ path: nested });
    const result = nestedRepo.setActiveWalletId("evm", "wallet-1");
    expect(result.isOk()).toBe(true);
    expect(nestedRepo.getActiveWalletId("evm")).toBe("wallet-1");
  });
});

// ---------------------------------------------------------------------------
// Persistence shape
// ---------------------------------------------------------------------------

describe("persistence shape", () => {
  it("serialises pretty-printed JSON with version 1", () => {
    repo.setActiveWalletId("evm", "wallet-1");
    const raw = readFileSync(path, "utf-8");
    expect(raw.includes("\n")).toBe(true); // pretty-printed
    const parsed = z.object({ version: z.number() }).parse(JSON.parse(raw));
    expect(parsed.version).toBe(1);
  });

  it("merges updates without dropping prior fields", () => {
    repo.setActiveWalletId("evm", "evm-1");
    repo.setTreasuryWalletId("evm", "treasury-evm-1");
    repo.setLastDeploymentWalletId("dep-1");

    const state = repo.get();
    expect(state.activeWalletIds.evm).toBe("evm-1");
    expect(state.treasuryWalletIds.evm).toBe("treasury-evm-1");
    expect(state.lastDeploymentWalletId).toBe("dep-1");
  });
});
