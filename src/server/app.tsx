import { randomUUID } from "node:crypto";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { privateKeyToAccount } from "viem/accounts";
import { checkEvmBalance, checkSvmBalance } from "~/lib/balance.js";
import { normalisePrivateKey, parseEvmCaip10 } from "~/lib/evm.js";
import { addWallet, decryptKey, encryptKey, getWallet } from "~/lib/keystore.js";
import {
  type CreateSessionInput,
  createSession,
  sessions,
  setResult,
  type TxResult,
} from "./sessions.js";
import { activeWallets, getWalletSession, setWalletSessionResult } from "./wallet-sessions.js";
import { WalletNewPage } from "./pages/wallet-new.js";
import { WalletProvidePage } from "./pages/wallet-provide.js";
import { WalletUnlockPage } from "./pages/wallet-unlock.js";
import { renderPage } from "./pages/layout.js";

type ChainType = "evm" | "svm";

function chainType(caip2: string): ChainType {
  return caip2.startsWith("solana:") ? "svm" : "evm";
}

function deriveAddress(privateKey: string, type: ChainType): string {
  if (type === "evm") return privateKeyToAccount(normalisePrivateKey(privateKey)).address;
  return Keypair.fromSecretKey(bs58.decode(privateKey)).publicKey.toBase58();
}

async function checkBalance(address: string, type: ChainType, chain: string) {
  if (type === "evm") {
    const { chainId } = parseEvmCaip10(`${chain}:${address}`);
    return checkEvmBalance(address, chainId, 300_000);
  }
  return checkSvmBalance(address);
}

export function buildApp() {
  const app = new Hono();

  app.use("*", cors());

  // ── Health ───────────────────────────────────────────────────────────────

  app.get("/health", (c) => c.json({ ok: true }));

  // ── Signing sessions ─────────────────────────────────────────────────────

  app.post("/sessions", async (c) => {
    let input: CreateSessionInput;
    try {
      input = await c.req.json<CreateSessionInput>();
    } catch {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const session = createSession(input);
    return c.json({ token: session.token, expires_at: session.expires_at }, 201);
  });

  app.get("/sessions/:token", (c) => {
    const token = c.req.param("token");
    const stored = sessions.get(token);
    if (!stored) return c.json({ error: "Session not found" }, 404);
    if (Date.now() > stored.expires_at) {
      sessions.delete(token);
      return c.json({ error: "Session expired" }, 410);
    }
    return c.json(stored);
  });

  app.put("/sessions/:token/result", async (c) => {
    const result = await c.req.json<TxResult>();
    const ok = setResult(c.req.param("token"), result);
    return ok ? c.json({ ok: true }) : c.json({ error: "Session not found or expired" }, 404);
  });

  // ── Wallet sessions (read — used by browser pages) ────────────────────────

  app.get("/wallet/sessions/:token", (c) => {
    const session = getWalletSession(c.req.param("token"));
    if (!session) return c.json({ error: "Session not found or expired" }, 404);
    const entry = session.walletId ? getWallet(session.walletId) : undefined;
    const { token, action, chain, address, privateKeyTemp } = session;
    return c.json({ token, action, chain, address, privateKeyTemp, label: entry?.label });
  });

  // ── Wallet unlock (stored wallet → password → decrypt) ───────────────────

  app.get("/wallet/unlock", (c) => {
    const token = c.req.query("token") ?? "";
    const base = c.req.query("api") ? decodeURIComponent(c.req.query("api")!) : "";

    const session = getWalletSession(token);
    if (!session?.walletId) return c.html(renderPage(<WalletUnlockPage token={token} base={base} label="Session not found" address="" />), 404);

    const entry = getWallet(session.walletId);
    if (!entry) return c.html(renderPage(<WalletUnlockPage token={token} base={base} label="Wallet not found" address="" />), 404);

    return c.html(renderPage(
      <WalletUnlockPage token={token} base={base} label={entry.label} address={entry.address} />,
    ));
  });

  app.post("/wallet/unlock/:token", async (c) => {
    const session = getWalletSession(c.req.param("token"));
    if (!session?.walletId) return c.json({ error: "Session not found or expired" }, 404);

    const entry = getWallet(session.walletId);
    if (!entry) return c.json({ error: "Wallet not found in keystore" }, 404);

    const { password } = await c.req.json<{ password: string }>();
    const result = decryptKey(entry, password);
    if (result.isErr()) return c.json({ ok: false, error: "Incorrect password." });

    const type = chainType(entry.chain);
    activeWallets.set(type, { privateKey: result.value, address: entry.address });
    setWalletSessionResult(session.token, { status: "success", address: entry.address });
    return c.json({ ok: true });
  });

  // ── Wallet provide (enter existing key, optionally save) ─────────────────

  app.get("/wallet/provide", (c) => {
    const token = c.req.query("token") ?? "";
    const base = c.req.query("api") ? decodeURIComponent(c.req.query("api")!) : "";
    return c.html(renderPage(<WalletProvidePage token={token} base={base} />));
  });

  app.post("/wallet/provide/:token", async (c) => {
    const session = getWalletSession(c.req.param("token"));
    if (!session) return c.json({ error: "Session not found or expired" }, 404);

    const { private_key, save, label, password } = await c.req.json<{
      private_key: string;
      save?: boolean;
      label?: string;
      password?: string;
    }>();

    const type = chainType(session.chain);
    let address: string;
    try {
      address = deriveAddress(private_key, type);
    } catch {
      return c.json({ ok: false, error: "Invalid private key format." });
    }

    const bal = await checkBalance(address, type, session.chain);
    const balInfo = bal.isOk() ? bal.value : null;

    if (save && label && password) {
      addWallet({
        id: randomUUID(),
        label,
        chain: session.chain,
        address,
        createdAt: Date.now(),
        ...encryptKey(private_key, password),
      });
    }

    activeWallets.set(type, { privateKey: private_key, address });
    setWalletSessionResult(session.token, { status: "success", address });

    return c.json({
      ok: true,
      insufficient_funds: balInfo ? !balInfo.sufficient : false,
      balance: balInfo?.balanceFormatted,
      required: balInfo?.requiredFormatted,
      symbol: balInfo?.symbol,
    });
  });

  // ── Wallet new (display generated keypair, confirm backup, save) ──────────

  app.get("/wallet/new", (c) => {
    const token = c.req.query("token") ?? "";
    const base = c.req.query("api") ? decodeURIComponent(c.req.query("api")!) : "";

    const session = getWalletSession(token);
    if (!session?.privateKeyTemp || !session.address) {
      return c.html(renderPage(<WalletProvidePage token={token} base={base} />), 404);
    }

    return c.html(renderPage(
      <WalletNewPage
        token={token}
        base={base}
        address={session.address}
        privateKeyTemp={session.privateKeyTemp}
      />,
    ));
  });

  app.post("/wallet/new/:token/confirm", async (c) => {
    const session = getWalletSession(c.req.param("token"));
    if (!session?.privateKeyTemp || !session.address) {
      return c.json({ error: "Session not found or expired" }, 404);
    }

    const { confirmed, label, password } = await c.req.json<{
      confirmed: boolean;
      label: string;
      password: string;
    }>();
    if (!confirmed) return c.json({ ok: false, error: "Backup not confirmed." });
    if (!label || !password)
      return c.json({ ok: false, error: "Label and password are required." });

    addWallet({
      id: randomUUID(),
      label,
      chain: session.chain,
      address: session.address,
      createdAt: Date.now(),
      ...encryptKey(session.privateKeyTemp, password),
    });

    const type = chainType(session.chain);
    activeWallets.set(type, { privateKey: session.privateKeyTemp, address: session.address });
    setWalletSessionResult(session.token, { status: "success", address: session.address });
    return c.json({ ok: true });
  });

  return app;
}
