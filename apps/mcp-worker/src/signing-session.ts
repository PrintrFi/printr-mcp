import { DurableObject } from "cloudflare:workers";

import {
  type CreateSessionInput,
  SESSION_TTL_MS,
  type TxResult,
  type TxSession,
} from "./session-types.js";

/**
 * Per-token signing-session store. One Durable Object instance per session
 * token (`idFromName(token)`), giving strongly-consistent reads so the web
 * signer never sees a stale 404 right after the session is created — the
 * reason this is a Durable Object and not KV. Sessions self-evict via an alarm
 * at their expiry.
 */
export class SigningSessionDO extends DurableObject<Env> {
  /** Persist a new session and schedule its expiry. */
  async create(
    input: CreateSessionInput,
    token: string,
  ): Promise<{ token: string; expires_at: number }> {
    const now = Date.now();
    const session: TxSession = {
      ...input,
      token,
      created_at: now,
      expires_at: now + SESSION_TTL_MS,
    };
    await this.ctx.storage.put("session", session);
    await this.ctx.storage.setAlarm(session.expires_at);
    return { token, expires_at: session.expires_at };
  }

  /** Read the session, or `null` if absent or expired. */
  async read(): Promise<TxSession | null> {
    const session = await this.ctx.storage.get<TxSession>("session");
    if (!session || Date.now() > session.expires_at) {
      return null;
    }
    return session;
  }

  /** Attach a signing result. Returns `false` if the session is gone or expired. */
  async setResult(result: TxResult): Promise<boolean> {
    const session = await this.read();
    if (!session) {
      return false;
    }
    await this.ctx.storage.put("session", { ...session, result });
    return true;
  }

  /** Evict the session when its TTL elapses. */
  override async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }
}
