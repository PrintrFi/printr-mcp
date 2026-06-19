import { ArrowRight, Coins, Layers, ShieldCheck, Terminal } from "lucide-react";
import Link from "next/link";
import { TwoslashSnippet } from "@/components/twoslash-snippet";
import { gitConfig } from "@/lib/shared";

const features = [
  {
    icon: Coins,
    title: "Cross-chain token launches",
    body: "Create tokens across EVM chains and Solana from a single, typed SDK — chain metadata, CAIP identifiers, and protocol fees handled for you.",
  },
  {
    icon: Layers,
    title: "SDK + MCP + CLI",
    body: "A pure TypeScript SDK, an MCP server that exposes it to AI agents, and a CLI to wire everything up. One source of truth, three surfaces.",
  },
  {
    icon: ShieldCheck,
    title: "Human-gated signing",
    body: "Browser wallet approval per transaction, or an encrypted local keystore you unlock for a session. You stay in control of every signature.",
  },
  {
    icon: Terminal,
    title: "Agent-ready",
    body: "Every tool ships Zod-validated input and output schemas. Drop the MCP server into Claude, Cursor, or any MCP client and start launching.",
  },
];

const SNIPPET = `import { buildToken, createPrintrClient, env } from "@printr/sdk";

const client = createPrintrClient({
  apiKey: env.PRINTR_API_KEY,
  baseUrl: env.PRINTR_API_BASE_URL,
});

const result = await buildToken(
  {
    creator_accounts: ["eip155:8453:0xYourAddress"],
    name: "My Token",
    symbol: "MINE",
    description: "A cross-chain token.",
    chains: ["eip155:8453"],
    initial_buy: { spend_usd: 10 },
    image_path: "./logo.jpg",
  },
  client,
);

result.match(
  (payload) => console.log("unsigned payload ready", payload),
  (error) => console.error(error),
);`;

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center px-4">
      {/* hero */}
      <section className="flex w-full max-w-5xl flex-col items-center pt-20 pb-16 text-center sm:pt-28">
        <span className="mb-5 rounded-full border border-fd-border bg-fd-secondary/60 px-3 py-1 text-xs font-medium tracking-wide text-fd-muted-foreground">
          SDK · MCP server · CLI
        </span>
        <h1 className="bg-gradient-to-b from-fd-foreground to-fd-foreground/60 bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-7xl">
          Printr
        </h1>
        <p className="mt-5 max-w-2xl text-balance text-lg text-fd-muted-foreground sm:text-xl">
          Launch cross-chain tokens from TypeScript or from an AI agent. One
          SDK for EVM chains and Solana, wrapped in an MCP server and a CLI.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/docs/getting-started"
            className="inline-flex items-center gap-2 rounded-lg bg-fd-primary px-5 py-2.5 text-sm font-semibold text-fd-primary-foreground transition-opacity hover:opacity-90"
          >
            Get started <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/docs"
            className="rounded-lg border border-fd-border px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-fd-accent"
          >
            Documentation
          </Link>
          <a
            href={`https://github.com/${gitConfig.user}/${gitConfig.repo}`}
            className="rounded-lg border border-fd-border px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-fd-accent"
          >
            GitHub
          </a>
        </div>
      </section>

      {/* code sample */}
      <section className="w-full max-w-3xl pb-20">
        <div className="overflow-hidden rounded-xl border border-fd-border bg-fd-card shadow-sm">
          <div className="flex items-center gap-1.5 border-b border-fd-border px-4 py-3">
            <span className="size-3 rounded-full bg-red-400/70" />
            <span className="size-3 rounded-full bg-yellow-400/70" />
            <span className="size-3 rounded-full bg-green-400/70" />
            <span className="ml-2 text-xs text-fd-muted-foreground">launch.ts</span>
          </div>
          <TwoslashSnippet code={SNIPPET} />
        </div>
      </section>

      {/* features */}
      <section className="grid w-full max-w-5xl gap-4 pb-24 sm:grid-cols-2">
        {features.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="rounded-xl border border-fd-border bg-fd-card p-5 transition-colors hover:border-fd-primary/40"
          >
            <div className="mb-3 inline-flex rounded-lg bg-fd-primary/10 p-2 text-fd-primary">
              <Icon className="size-5" />
            </div>
            <h2 className="mb-1.5 font-semibold">{title}</h2>
            <p className="text-sm text-fd-muted-foreground">{body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
