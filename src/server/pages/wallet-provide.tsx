import type { FC } from "hono/jsx";
import { Layout } from "./layout.js";

type Props = {
  token: string;
  base: string;
};

const buildScript = (token: string, base: string) => `
  function walletProvide() {
    return {
      privateKey: "",
      save: false,
      label: "",
      password: "",
      loading: false,
      error: null,
      success: false,
      successMsg: "Key accepted. Return to the agent — it will proceed with signing.",
      async submit() {
        if (!this.privateKey) { this.error = "Please enter a private key."; return; }
        if (this.save && !this.label) { this.error = "Please enter a wallet label."; return; }
        if (this.save && !this.password) { this.error = "Please enter a password to encrypt the wallet."; return; }
        this.loading = true;
        this.error = null;
        const res = await fetch(${JSON.stringify(`${base}/wallet/provide/${token}`)}, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            private_key: this.privateKey,
            save: this.save,
            label: this.save ? this.label : undefined,
            password: this.save ? this.password : undefined,
          }),
        });
        const data = await res.json();
        this.loading = false;
        if (data.ok) {
          if (data.insufficient_funds) {
            this.successMsg = \`Key accepted but wallet needs funding. Balance: \${data.balance} \${data.symbol}. Required: \${data.required} \${data.symbol}. Fund the wallet then ask the agent to sign again.\`;
          }
          this.success = true;
        } else {
          this.error = data.error ?? "Could not process the key.";
        }
      },
    };
  }
`;

export const WalletProvidePage: FC<Props> = ({ token, base }) => (
  <Layout title="Provide Wallet Key — Printr" script={buildScript(token, base)}>
    <div x-data="walletProvide()" x-cloak>
      <div x-show="!success">
        <h1 class="text-lg font-semibold mb-1">Provide a Private Key</h1>
        <p class="text-sm text-zinc-500 mb-6">
          Enter your existing wallet private key. It will be used to sign the transaction and never shared.
        </p>

        <div class="mb-4">
          <label class="block text-xs text-zinc-400 mb-1.5" for="private-key">Private Key</label>
          <input
            type="password"
            id="private-key"
            placeholder="0x… or base58 keypair"
            autocomplete="off"
            x-model="privateKey"
            class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm font-mono text-zinc-200 outline-none focus:border-blue-400 transition-colors"
          />
        </div>

        <label for="save-toggle" class="flex items-center gap-2 cursor-pointer text-xs text-zinc-400 mt-2">
          <input type="checkbox" id="save-toggle" x-model="save" class="rounded" />
          Save this wallet to keystore
        </label>

        <div x-show="save" class="mt-3 space-y-3">
          <div>
            <label class="block text-xs text-zinc-400 mb-1.5" for="label">Wallet label</label>
            <input
              type="text"
              id="label"
              placeholder="e.g. My Base Wallet"
              x-model="label"
              class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-blue-400 transition-colors"
            />
          </div>
          <div>
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
        </div>

        <button
          type="button"
          x-on="{ click: submit }"
          x-bind="{ disabled: loading }"
          class="w-full mt-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-default rounded-lg text-white text-sm font-medium transition-colors"
        >
          <span x-text="loading ? 'Verifying\u2026' : 'Use this key'">Use this key</span>
        </button>

        <div
          x-show="error"
          x-text="error"
          class="mt-3 px-3 py-2.5 bg-red-950 border border-red-900 rounded-lg text-red-400 text-xs"
        />
      </div>

      <div x-show="success" class="flex flex-col items-center text-center py-6">
        <div class="text-4xl mb-2">✓</div>
        <p x-text="successMsg" class="text-emerald-400 text-sm" />
      </div>
    </div>
  </Layout>
);
