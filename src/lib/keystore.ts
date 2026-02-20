import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { err, ok, type Result } from "neverthrow";
import { env } from "~/lib/env.js";

export type WalletEntry = {
  id: string;
  label: string;
  /** CAIP-2 chain ID, e.g. "eip155:8453" */
  chain: string;
  /** Plaintext public address — safe to read without password */
  address: string;
  kdf: "scrypt";
  kdfParams: { N: number; r: number; p: number; dkLen: number };
  /** base64-encoded random salt */
  salt: string;
  /** base64-encoded GCM nonce */
  iv: string;
  /** base64-encoded AES-256-GCM ciphertext + 16-byte auth tag */
  encryptedKey: string;
  createdAt: number;
};

type Keystore = {
  version: 1;
  wallets: WalletEntry[];
};

const DEFAULT_KDF_PARAMS = { N: 131072, r: 8, p: 1, dkLen: 32 } as const;

export function keystorePath(): string {
  return env.PRINTR_WALLET_STORE ?? join(homedir(), ".printr", "wallets.json");
}

function loadKeystore(): Keystore {
  try {
    const raw = readFileSync(keystorePath(), "utf-8");
    return JSON.parse(raw) as Keystore;
  } catch {
    return { version: 1, wallets: [] };
  }
}

function saveKeystore(ks: Keystore): void {
  const path = keystorePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(ks, null, 2), "utf-8");
}

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
    });
    const decipher = createDecipheriv("aes-256-gcm", dk, ivBuf);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf-8");
    return ok(plain);
  } catch {
    return err("wrong_password");
  }
}

export function listWallets(chain?: string): WalletEntry[] {
  const ks = loadKeystore();
  return chain ? ks.wallets.filter((w) => w.chain === chain) : ks.wallets;
}

export function getWallet(id: string): WalletEntry | undefined {
  return loadKeystore().wallets.find((w) => w.id === id);
}

export function addWallet(entry: WalletEntry): void {
  const ks = loadKeystore();
  ks.wallets.push(entry);
  saveKeystore(ks);
}
