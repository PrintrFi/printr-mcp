import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fromThrowable, type Result } from "neverthrow";
import { env } from "./env.js";

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

/** Absolute path to the persistent state JSON (defaults to `~/.printr/state.json`). */
export function statePath(): string {
  const dir = env.PRINTR_WALLET_STORE ?? join(homedir(), ".printr");
  return join(dir, "state.json");
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

/** Get the active wallet id for a chain family, or `undefined` if none is set. */
export function getActiveWalletId(chainType: ChainTypeKey): string | undefined {
  return loadState().activeWalletIds[chainType];
}

/** Set the active wallet id for a chain family. Writes atomically via rename. */
export function setActiveWalletId(
  chainType: ChainTypeKey,
  walletId: string,
): Result<void, StateError> {
  return updateState((state) => {
    state.activeWalletIds[chainType] = walletId;
  });
}

/** Unset the active wallet id for a chain family. */
export function clearActiveWalletId(chainType: ChainTypeKey): Result<void, StateError> {
  return updateState((state) => {
    delete state.activeWalletIds[chainType];
  });
}

/** Get the treasury wallet id for a chain family, or `undefined` if none is set. */
export function getTreasuryWalletId(chainType: ChainTypeKey): string | undefined {
  return loadState().treasuryWalletIds[chainType];
}

/** Set the treasury wallet id for a chain family. */
export function setTreasuryWalletId(
  chainType: ChainTypeKey,
  walletId: string,
): Result<void, StateError> {
  return updateState((state) => {
    state.treasuryWalletIds[chainType] = walletId;
  });
}

/** Get the wallet id used by the most recent token deployment (for drain recovery). */
export function getLastDeploymentWalletId(): string | undefined {
  return loadState().lastDeploymentWalletId;
}

/** Record the wallet id used for a token deployment so funds can be drained after a restart. */
export function setLastDeploymentWalletId(walletId: string): Result<void, StateError> {
  return updateState((state) => {
    state.lastDeploymentWalletId = walletId;
  });
}

/** Clear the last-deployment marker once recovery is complete. */
export function clearLastDeploymentWalletId(): Result<void, StateError> {
  return updateState((state) => {
    // biome-ignore lint/performance/noDelete: only way to remove optional property with exactOptionalPropertyTypes
    delete state.lastDeploymentWalletId;
  });
}

/** Read the full persistent state. Returns the default shape if no file exists or parsing fails. */
export function getState(): PersistentState {
  return loadState();
}
