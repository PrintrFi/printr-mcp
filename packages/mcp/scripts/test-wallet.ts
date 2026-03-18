#!/usr/bin/env bun
/**
 * Smoke-test for wallet create → unlock flow.
 * Uses a throw-away keystore file; cleans up on exit.
 */
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

// Point at a temp store so we never touch ~/.printr/wallets.json
const STORE = join(tmpdir(), `printr-test-wallets-${Date.now()}.json`);
process.env.PRINTR_WALLET_STORE = STORE;

// Import after setting the env var so keystorePath() picks it up
const { addWallet, decryptKey, encryptKey, getWallet, removeWallet } = await import(
  "../src/lib/keystore.js"
);

const PASSWORD = "hunter2";
const LABEL = "test-wallet";
const CHAIN = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

function pass(msg: string) {
  process.stdout.write(`  ✓  ${msg}\n`);
}

function fail(msg: string) {
  process.stderr.write(`  ✗  ${msg}\n`);
  process.exit(1);
}

function section(title: string) {
  process.stdout.write(`\n── ${title} ──\n`);
}

// ── 1. Create ─────────────────────────────────────────────────────────────────
section("1. Create wallet");

const kp = Keypair.generate();
const privateKey = bs58.encode(kp.secretKey);
const address = kp.publicKey.toBase58();
const id = randomUUID();

addWallet({
  id,
  label: LABEL,
  chain: CHAIN,
  address,
  createdAt: Date.now(),
  ...encryptKey(privateKey, PASSWORD),
});

pass(`Generated keypair  ${address}`);
pass(`Saved to keystore  ${STORE} (id: ${id})`);

// ── 2. List / retrieve ────────────────────────────────────────────────────────
section("2. Retrieve from keystore");

const entry = getWallet(id);
if (!entry) fail("wallet not found in keystore");
if (entry.address !== address) fail(`address mismatch: ${entry.address}`);
if (entry.label !== LABEL) fail(`label mismatch: ${entry.label}`);

pass(`Found wallet "${entry.label}" on ${entry.chain}`);
pass(`Address matches  ${entry.address}`);

// ── 3. Unlock with correct password ──────────────────────────────────────────
section("3. Unlock with correct password");

const good = decryptKey(entry, PASSWORD);
if (good.isErr()) fail("decryption failed with correct password");
if (good.value !== privateKey) fail("decrypted key does not match original");

pass("Decrypted successfully");
pass("Private key round-trips correctly");

// ── 4. Unlock with wrong password ────────────────────────────────────────────
section("4. Unlock with wrong password (expect failure)");

const bad = decryptKey(entry, "wrong-password");
if (bad.isOk()) fail("decryption should have failed with wrong password");

pass(`Rejected wrong password (err: ${bad.error})`);

// ── 5. Remove ─────────────────────────────────────────────────────────────────
section("5. Remove wallet");

const removed = removeWallet(id);
if (!removed) fail("removeWallet returned false");
const gone = getWallet(id);
if (gone) fail("wallet still present after removal");

pass("Wallet removed from keystore");

// ── Cleanup ───────────────────────────────────────────────────────────────────
rmSync(STORE, { force: true });

process.stdout.write("\nAll checks passed.\n");
