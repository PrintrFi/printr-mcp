import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fromThrowable, type Result } from "neverthrow";
import { env } from "~/lib/env.js";

export type ChainTypeKey = "svm" | "evm";

export type PersistentState = {
  version: 1;
  /** Active wallet IDs by chain type - reference to keystore wallet IDs */
  activeWalletIds: Partial<Record<ChainTypeKey, string>>;
  /** Treasury wallet IDs by chain type - reference to keystore wallet IDs */
  treasuryWalletIds: Partial<Record<ChainTypeKey, string>>;
  /** Last deployment wallet ID - for drain recovery after restart */
  lastDeploymentWalletId?: string;
};

export type StateError = { message: string };

const DEFAULT_STATE: PersistentState = {
  version: 1,
  activeWalletIds: {},
  treasuryWalletIds: {},
};

export function statePath(): string {
  const keystorePath = env.PRINTR_WALLET_STORE ?? join(homedir(), ".printr", "wallets.json");
  return join(dirname(keystorePath), "state.json");
}

const toStateError = (e: unknown): StateError => ({
  message: e instanceof Error ? e.message : String(e),
});

const safeReadFile = fromThrowable((path: string) => readFileSync(path, "utf-8"), toStateError);

const safeParseJson = fromThrowable(
  (raw: string) => JSON.parse(raw) as PersistentState,
  toStateError,
);

function loadState(): PersistentState {
  return safeReadFile(statePath())
    .andThen(safeParseJson)
    .unwrapOr({ ...DEFAULT_STATE });
}

function saveState(state: PersistentState): Result<void, StateError> {
  const path = statePath();
  const tmpPath = `${path}.tmp`;

  const safeWrite = fromThrowable(() => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(tmpPath, JSON.stringify(state, null, 2), "utf-8");
    renameSync(tmpPath, path); // Atomic on POSIX
  }, toStateError);

  return safeWrite();
}

function updateState(fn: (state: PersistentState) => void): Result<void, StateError> {
  const state = loadState();
  fn(state);
  return saveState(state);
}

export function getActiveWalletId(chainType: ChainTypeKey): string | undefined {
  return loadState().activeWalletIds[chainType];
}

export function setActiveWalletId(
  chainType: ChainTypeKey,
  walletId: string,
): Result<void, StateError> {
  return updateState((state) => {
    state.activeWalletIds[chainType] = walletId;
  });
}

export function clearActiveWalletId(chainType: ChainTypeKey): Result<void, StateError> {
  return updateState((state) => {
    state.activeWalletIds[chainType] = undefined;
  });
}

export function getTreasuryWalletId(chainType: ChainTypeKey): string | undefined {
  return loadState().treasuryWalletIds[chainType];
}

export function setTreasuryWalletId(
  chainType: ChainTypeKey,
  walletId: string,
): Result<void, StateError> {
  return updateState((state) => {
    state.treasuryWalletIds[chainType] = walletId;
  });
}

export function getLastDeploymentWalletId(): string | undefined {
  return loadState().lastDeploymentWalletId;
}

export function setLastDeploymentWalletId(walletId: string): Result<void, StateError> {
  return updateState((state) => {
    state.lastDeploymentWalletId = walletId;
  });
}

export function clearLastDeploymentWalletId(): Result<void, StateError> {
  return updateState((state) => {
    state.lastDeploymentWalletId = undefined;
  });
}

export function getState(): PersistentState {
  return loadState();
}
