import type { FC } from "hono/jsx";
import { Layout } from "./layout.js";

type Props = {
  token: string;
  base: string;
  label: string;
  address: string;
};

const buildScript = (token: string, base: string) => `
  function walletUnlock() {
    return {
      password: "",
      loading: false,
      error: null,
      success: false,
      async submit() {
        if (!this.password) return;
        this.loading = true;
        this.error = null;
        const res = await fetch(${JSON.stringify(`${base}/wallet/unlock/${token}`)}, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: this.password }),
        });
        const data = await res.json();
        this.loading = false;
        if (data.ok) { this.success = true; }
        else { this.error = data.error ?? "Incorrect password."; }
      },
    };
  }
`;

export const WalletUnlockPage: FC<Props> = ({ token, base, label, address }) => (
  <Layout title="Unlock Wallet — Printr" script={buildScript(token, base)}>
    <div x-data="walletUnlock()" x-cloak>
      <div x-show="!success">
        <h1 class="text-lg font-semibold mb-1">Unlock Wallet</h1>
        <p class="text-sm text-zinc-500 mb-6">Enter your password to decrypt this wallet.</p>

        <div class="bg-zinc-800/50 border border-zinc-800 rounded-lg px-4 py-3 mb-5 text-xs text-zinc-400 break-all">
          <strong class="text-zinc-200 block mb-1">{label}</strong>
          {address}
        </div>

        <div class="mb-4">
          <label class="block text-xs text-zinc-400 mb-1.5" for="password">
            Password
          </label>
          <input
            type="password"
            id="password"
            placeholder="Your keystore password"
            autocomplete="current-password"
            x-model="password"
            x-on="{ 'keydown.enter': submit }"
            class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-blue-400 transition-colors"
          />
        </div>

        <button
          type="button"
          x-on="{ click: submit }"
          x-bind="{ disabled: loading }"
          class="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-default rounded-lg text-white text-sm font-medium transition-colors"
        >
          <span x-text="loading ? 'Unlocking\u2026' : 'Unlock'">Unlock</span>
        </button>

        <div
          x-show="error"
          x-text="error"
          class="mt-3 px-3 py-2.5 bg-red-950 border border-red-900 rounded-lg text-red-400 text-xs"
        />
      </div>

      <div x-show="success" class="flex flex-col items-center text-center py-6">
        <div class="text-4xl mb-2">✓</div>
        <p class="text-emerald-400 text-sm">
          Wallet unlocked. Return to the agent and ask it to sign again.
        </p>
      </div>
    </div>
  </Layout>
);
