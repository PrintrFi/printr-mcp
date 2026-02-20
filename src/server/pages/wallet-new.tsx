import type { FC } from "hono/jsx";
import { Layout } from "./layout.js";

type Props = {
  token: string;
  base: string;
  address: string;
  privateKeyTemp: string;
};

const buildScript = (token: string, base: string) => `
  function walletNew() {
    return {
      revealed: false,
      backedUp: false,
      label: "",
      password: "",
      loading: false,
      error: null,
      success: false,
      get canSubmit() { return this.backedUp && this.label && this.password; },
      toggleReveal() { this.revealed = !this.revealed; },
      async submit() {
        if (!this.canSubmit) return;
        this.loading = true;
        this.error = null;
        const res = await fetch(${JSON.stringify(`${base}/wallet/new/${token}/confirm`)}, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmed: true, label: this.label, password: this.password }),
        });
        const data = await res.json();
        this.loading = false;
        if (data.ok) { this.success = true; }
        else { this.error = data.error ?? "Could not save the wallet."; }
      },
    };
  }
`;

export const WalletNewPage: FC<Props> = ({ token, base, address, privateKeyTemp }) => (
  <Layout title="New Wallet — Printr" script={buildScript(token, base)}>
    <div x-data="walletNew()" x-cloak>
      <div x-show="!success">
        <h1 class="text-lg font-semibold mb-1">New Wallet Created</h1>
        <p class="text-sm text-zinc-500 mb-6">
          Save the details below before continuing. The private key will not be shown again.
        </p>

        <div class="bg-amber-950/50 border border-amber-800 rounded-lg px-4 py-3 text-amber-400 text-xs mb-5">
          ⚠ Back up your private key now. Anyone with this key can spend your funds. Store it somewhere safe and offline.
        </div>

        <div class="mb-4">
          <label class="block text-xs text-zinc-400 mb-1.5">Public Address</label>
          <div class="bg-zinc-800/50 border border-zinc-800 rounded-lg px-3 py-2 font-mono text-xs text-blue-400 break-all">
            {address}
          </div>
        </div>

        <div class="mb-4">
          <label class="block text-xs text-zinc-400 mb-1.5">Private Key</label>
          <div class="relative">
            <input
              id="private-key"
              value={privateKeyTemp}
              readonly
              x-bind="{ type: revealed ? 'text' : 'password' }"
              class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 pr-14 text-sm font-mono text-zinc-200 outline-none"
            />
            <button
              type="button"
              x-on="{ click: toggleReveal }"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1 transition-colors"
            >
              <span x-text="revealed ? 'Hide' : 'Show'">Show</span>
            </button>
          </div>
        </div>

        <label for="backed-up" class="flex items-start gap-2 cursor-pointer text-xs text-zinc-400 mb-4">
          <input type="checkbox" id="backed-up" x-model="backedUp" class="mt-0.5 flex-shrink-0" />
          I have securely backed up my private key
        </label>

        <div class="mb-4">
          <label class="block text-xs text-zinc-400 mb-1.5" for="label">Wallet label</label>
          <input
            type="text"
            id="label"
            placeholder="e.g. My Base Wallet"
            x-model="label"
            class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-blue-400 transition-colors"
          />
        </div>

        <div class="mb-4">
          <label class="block text-xs text-zinc-400 mb-1.5" for="password">Keystore password</label>
          <input
            type="password"
            id="password"
            placeholder="Choose a strong password"
            autocomplete="new-password"
            x-model="password"
            class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-blue-400 transition-colors"
          />
        </div>

        <button
          type="button"
          x-on="{ click: submit }"
          x-bind="{ disabled: !canSubmit || loading }"
          class="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-default rounded-lg text-white text-sm font-medium transition-colors"
        >
          <span x-text="loading ? 'Saving\u2026' : 'Save \u0026 continue'">Save &amp; continue</span>
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
          Wallet saved. Fund it with the required tokens then ask the agent to sign again.
        </p>
      </div>
    </div>
  </Layout>
);
