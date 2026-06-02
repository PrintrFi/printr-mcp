import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fromThrowable, type Result } from "neverthrow";
import { z } from "zod";
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

/** Pure dependencies needed to persist state. Tests pass a tmpfile path. */
export type StateDeps = {
  /** Absolute path to the persistent state JSON. */
  path: string;
};

/**
 * Capability bundle for reading and mutating persistent wallet state.
 * Production wires `createStateRepo({ path: statePath() })`; tests pass a
 * tmpfile so they never touch `~/.printr/state.json`.
 */
export type StateRepo = {
  /** Read the full persistent state. Falls back to defaults on missing or corrupt files. */
  get(): PersistentState;
  /** Active wallet id for a chain family, or `undefined` if none is set. */
  getActiveWalletId(chainType: ChainTypeKey): string | undefined;
  /** Set the active wallet id for a chain family. Atomic via temp-rename. */
  setActiveWalletId(chainType: ChainTypeKey, walletId: string): Result<void, StateError>;
  /** Unset the active wallet id for a chain family. */
  clearActiveWalletId(chainType: ChainTypeKey): Result<void, StateError>;
  /** Treasury wallet id for a chain family, or `undefined` if none is set. */
  getTreasuryWalletId(chainType: ChainTypeKey): string | undefined;
  /** Set the treasury wallet id for a chain family. */
  setTreasuryWalletId(chainType: ChainTypeKey, walletId: string): Result<void, StateError>;
  /** Wallet id used by the most recent token deployment (for drain recovery). */
  getLastDeploymentWalletId(): string | undefined;
  /** Record the wallet id used for a token deployment. */
  setLastDeploymentWalletId(walletId: string): Result<void, StateError>;
  /** Clear the last-deployment marker once recovery completes. */
  clearLastDeploymentWalletId(): Result<void, StateError>;
};

/**
 * Factory rather than a shared constant — `{ ...DEFAULT_STATE }` is a shallow
 * spread that leaks the inner `activeWalletIds` / `treasuryWalletIds` objects
 * by reference, so the first mutation poisons every subsequent missing-file
 * fallback in the same process.
 */
const makeDefaultState = (): PersistentState => ({
  version: 1,
  activeWalletIds: {},
  treasuryWalletIds: {},
});

/** Absolute path to the persistent state JSON (defaults to `~/.printr/state.json`). */
export function statePath(): string {
  const dir = env.PRINTR_WALLET_STORE ?? join(homedir(), ".printr");
  return join(dir, "state.json");
}

const toStateError = (e: unknown): StateError => ({
  message: e instanceof Error ? e.message : String(e),
});

const walletIdsSchema = z.partialRecord(z.enum(["svm", "evm"]), z.string());

const PersistentStateSchema = z.object({
  version: z.literal(1),
  activeWalletIds: walletIdsSchema,
  treasuryWalletIds: walletIdsSchema,
  lastDeploymentWalletId: z.string().optional(),
});

/** Build a {@link PersistentState} from validated data, omitting the optional marker when absent. */
function toPersistentState(data: z.infer<typeof PersistentStateSchema>): PersistentState {
  const base: PersistentState = {
    version: data.version,
    activeWalletIds: data.activeWalletIds,
    treasuryWalletIds: data.treasuryWalletIds,
  };
  return data.lastDeploymentWalletId === undefined
    ? base
    : { ...base, lastDeploymentWalletId: data.lastDeploymentWalletId };
}

const safeReadFile = fromThrowable((path: string) => readFileSync(path, "utf-8"), toStateError);

const safeParseJson = fromThrowable(
  (raw: string): PersistentState => toPersistentState(PersistentStateSchema.parse(JSON.parse(raw))),
  toStateError,
);

function loadStateFrom(path: string): PersistentState {
  return safeReadFile(path).andThen(safeParseJson).unwrapOr(makeDefaultState());
}

function saveStateTo(path: string, state: PersistentState): Result<void, StateError> {
  const tmpPath = `${path}.tmp`;
  const safeWrite = fromThrowable(() => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(tmpPath, JSON.stringify(state, null, 2), "utf-8");
    renameSync(tmpPath, path); // Atomic on POSIX
  }, toStateError);
  return safeWrite();
}

function updateStateAt(
  path: string,
  fn: (state: PersistentState) => void,
): Result<void, StateError> {
  const state = loadStateFrom(path);
  fn(state);
  return saveStateTo(path, state);
}

/**
 * Build a {@link StateRepo} bound to a specific file path. Pure factory —
 * no module-level singletons, no `env` reads inside the returned methods.
 * Tests instantiate against a tmpfile; production wires it to {@link statePath}.
 */
export function createStateRepo(deps: StateDeps): StateRepo {
  return {
    get: () => loadStateFrom(deps.path),
    getActiveWalletId: (chainType) => loadStateFrom(deps.path).activeWalletIds[chainType],
    setActiveWalletId: (chainType, walletId) =>
      updateStateAt(deps.path, (state) => {
        state.activeWalletIds[chainType] = walletId;
      }),
    clearActiveWalletId: (chainType) =>
      updateStateAt(deps.path, (state) => {
        delete state.activeWalletIds[chainType];
      }),
    getTreasuryWalletId: (chainType) => loadStateFrom(deps.path).treasuryWalletIds[chainType],
    setTreasuryWalletId: (chainType, walletId) =>
      updateStateAt(deps.path, (state) => {
        state.treasuryWalletIds[chainType] = walletId;
      }),
    getLastDeploymentWalletId: () => loadStateFrom(deps.path).lastDeploymentWalletId,
    setLastDeploymentWalletId: (walletId) =>
      updateStateAt(deps.path, (state) => {
        state.lastDeploymentWalletId = walletId;
      }),
    clearLastDeploymentWalletId: () =>
      updateStateAt(deps.path, (state) => {
        // biome-ignore lint/performance/noDelete: only way to remove optional property with exactOptionalPropertyTypes
        delete state.lastDeploymentWalletId;
      }),
  };
}

// ---------------------------------------------------------------------------
// Top-level delegates — preserve the existing call surface for MCP tools.
// Each call resolves `statePath()` lazily so a runtime override of
// `PRINTR_WALLET_STORE` (e.g. in tests that re-evaluate `env`) is honored.
// ---------------------------------------------------------------------------

/** Get the active wallet id for a chain family, or `undefined` if none is set. */
export function getActiveWalletId(chainType: ChainTypeKey): string | undefined {
  return loadStateFrom(statePath()).activeWalletIds[chainType];
}

/** Set the active wallet id for a chain family. Writes atomically via rename. */
export function setActiveWalletId(
  chainType: ChainTypeKey,
  walletId: string,
): Result<void, StateError> {
  return updateStateAt(statePath(), (state) => {
    state.activeWalletIds[chainType] = walletId;
  });
}

/** Unset the active wallet id for a chain family. */
export function clearActiveWalletId(chainType: ChainTypeKey): Result<void, StateError> {
  return updateStateAt(statePath(), (state) => {
    delete state.activeWalletIds[chainType];
  });
}

/** Get the treasury wallet id for a chain family, or `undefined` if none is set. */
export function getTreasuryWalletId(chainType: ChainTypeKey): string | undefined {
  return loadStateFrom(statePath()).treasuryWalletIds[chainType];
}

/** Set the treasury wallet id for a chain family. */
export function setTreasuryWalletId(
  chainType: ChainTypeKey,
  walletId: string,
): Result<void, StateError> {
  return updateStateAt(statePath(), (state) => {
    state.treasuryWalletIds[chainType] = walletId;
  });
}

/** Get the wallet id used by the most recent token deployment (for drain recovery). */
export function getLastDeploymentWalletId(): string | undefined {
  return loadStateFrom(statePath()).lastDeploymentWalletId;
}

/** Record the wallet id used for a token deployment so funds can be drained after a restart. */
export function setLastDeploymentWalletId(walletId: string): Result<void, StateError> {
  return updateStateAt(statePath(), (state) => {
    state.lastDeploymentWalletId = walletId;
  });
}

/** Clear the last-deployment marker once recovery is complete. */
export function clearLastDeploymentWalletId(): Result<void, StateError> {
  return updateStateAt(statePath(), (state) => {
    // biome-ignore lint/performance/noDelete: only way to remove optional property with exactOptionalPropertyTypes
    delete state.lastDeploymentWalletId;
  });
}

/** Read the full persistent state. Returns the default shape if no file exists or parsing fails. */
export function getState(): PersistentState {
  return loadStateFrom(statePath());
}
