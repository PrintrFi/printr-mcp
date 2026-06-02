import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { err, ok, type Result } from "neverthrow";
import { z } from "zod";
import { env } from "./env.js";

const WalletEntrySchema = z.object({
  id: z.string(),
  label: z.string(),
  /** CAIP-2 chain ID, e.g. "eip155:8453" */
  chain: z.string(),
  /** Plaintext public address — safe to read without password */
  address: z.string(),
  kdf: z.literal("scrypt"),
  kdfParams: z.object({
    N: z.number(),
    r: z.number(),
    p: z.number(),
    dkLen: z.number(),
  }),
  /** base64-encoded random salt */
  salt: z.string(),
  /** base64-encoded GCM nonce */
  iv: z.string(),
  /** base64-encoded AES-256-GCM ciphertext + 16-byte auth tag */
  encryptedKey: z.string(),
  createdAt: z.number(),
});

const KeystoreSchema = z.object({
  version: z.literal(1),
  wallets: z.array(WalletEntrySchema),
});

/**
 * A single encrypted wallet record. Derived from {@link WalletEntrySchema} so
 * the Zod schema remains the single source of truth for the on-disk shape.
 */
export type WalletEntry = z.infer<typeof WalletEntrySchema>;

type Keystore = z.infer<typeof KeystoreSchema>;

const DEFAULT_KDF_PARAMS = { N: 131072, r: 8, p: 1, dkLen: 32 } as const;
// 128 * N * r bytes required; default OpenSSL cap is 32 MB — raise it to 256 MB.
const SCRYPT_MAXMEM = 256 * 1024 * 1024;

/** Absolute path to the keystore JSON file (defaults to `~/.printr/wallets.json`). */
export function keystorePath(): string {
  const dir = env.PRINTR_WALLET_STORE ?? join(homedir(), ".printr");
  return join(dir, "wallets.json");
}

/**
 * Read and validate the keystore. A missing file yields an empty keystore (first
 * run), but a file that exists and fails to parse throws rather than returning
 * empty — otherwise the next `saveKeystore` would overwrite real encrypted keys
 * with an empty store. The on-disk file is never modified by a failed read.
 */
function loadKeystore(): Keystore {
  const path = keystorePath();
  if (!existsSync(path)) {
    return { version: 1, wallets: [] };
  }
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    throw new Error(
      `Keystore at ${path} is not valid JSON. Left untouched to protect encrypted keys; fix or move the file, then retry.`,
    );
  }
  const parsed = KeystoreSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `Keystore at ${path} does not match the expected schema. Left untouched to protect encrypted keys; fix or move the file, then retry. (${z.prettifyError(parsed.error)})`,
    );
  }
  return parsed.data;
}

function saveKeystore(ks: Keystore): void {
  const path = keystorePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(ks, null, 2), "utf-8");
}

/**
 * Encrypt a private key with `password` via scrypt + AES-256-GCM.
 * Returns the crypto fields to be merged into a {@link WalletEntry}.
 */
export function encryptKey(
  privateKey: string,
  password: string,
): Pick<WalletEntry, "kdf" | "kdfParams" | "salt" | "iv" | "encryptedKey"> {
  const kdfParams = DEFAULT_KDF_PARAMS;
  const salt = randomBytes(32);
  const iv = randomBytes(12);
  const dk = scryptSync(password, salt, kdfParams.dkLen, {
    N: kdfParams.N,
    r: kdfParams.r,
    p: kdfParams.p,
    maxmem: SCRYPT_MAXMEM,
  });
  const cipher = createCipheriv("aes-256-gcm", dk, iv);
  const ct = Buffer.concat([cipher.update(privateKey, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    kdf: "scrypt",
    kdfParams,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    encryptedKey: Buffer.concat([ct, tag]).toString("base64"),
  };
}

/**
 * Decrypt a wallet entry's private key. Returns `wrong_password` on any
 * scrypt/GCM failure — the auth tag makes wrong passwords indistinguishable from tampering.
 */
export function decryptKey(entry: WalletEntry, password: string): Result<string, "wrong_password"> {
  try {
    const { kdfParams, salt, iv, encryptedKey } = entry;
    const saltBuf = Buffer.from(salt, "base64");
    const ivBuf = Buffer.from(iv, "base64");
    const enc = Buffer.from(encryptedKey, "base64");
    const ct = enc.subarray(0, -16);
    const tag = enc.subarray(-16);
    const dk = scryptSync(password, saltBuf, kdfParams.dkLen, {
      N: kdfParams.N,
      r: kdfParams.r,
      p: kdfParams.p,
      maxmem: SCRYPT_MAXMEM,
    });
    const decipher = createDecipheriv("aes-256-gcm", dk, ivBuf);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf-8");
    return ok(plain);
  } catch {
    return err("wrong_password");
  }
}

/** List all wallets, optionally filtered by CAIP-2 chain id. */
export function listWallets(chain?: string): WalletEntry[] {
  const ks = loadKeystore();
  return chain ? ks.wallets.filter((w) => w.chain === chain) : ks.wallets;
}

/** Look up a wallet by its id, or `undefined` if not present. */
export function getWallet(id: string): WalletEntry | undefined {
  return loadKeystore().wallets.find((w) => w.id === id);
}

/** Append a wallet to the keystore and persist to disk. Caller is responsible for id uniqueness. */
export function addWallet(entry: WalletEntry): void {
  const ks = loadKeystore();
  ks.wallets.push(entry);
  saveKeystore(ks);
}

/** Remove a wallet by id. Returns `true` if a wallet was removed, `false` if no match. */
export function removeWallet(id: string): boolean {
  const ks = loadKeystore();
  const idx = ks.wallets.findIndex((w) => w.id === id);
  if (idx === -1) {
    return false;
  }
  ks.wallets.splice(idx, 1);
  saveKeystore(ks);
  return true;
}

/** Bulk-remove wallets by id. Returns the number actually removed; skips disk write when zero. */
export function removeWallets(ids: string[]): number {
  const ks = loadKeystore();
  const initialCount = ks.wallets.length;
  ks.wallets = ks.wallets.filter((w) => !ids.includes(w.id));
  const removedCount = initialCount - ks.wallets.length;
  if (removedCount > 0) {
    saveKeystore(ks);
  }
  return removedCount;
}
