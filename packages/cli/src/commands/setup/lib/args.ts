import { z } from "zod";
import { type ClientId, ClientIdSchema } from "./clients.js";

export interface SetupArgs {
  /** Explicit client IDs from --client flags; null means "show interactive selection". */
  targetIds: ClientId[] | null;
  openrouterApiKey: string;
}

const RawSetupArgsSchema = z.object({
  clients: z.array(z.string()).default([]),
  openrouterApiKey: z.string().default(""),
});

type RawSetupArgs = z.infer<typeof RawSetupArgsSchema>;

interface FlagMatch {
  value: string;
  /** How many tokens this match consumed beyond `args[index]`. */
  advance: number;
}

function matchFlag(arg: string, flag: string, args: string[], index: number): FlagMatch | null {
  if (arg === flag) {
    const value = args[index + 1];
    if (value === undefined) {
      return null;
    }
    return { value, advance: 1 };
  }
  const prefix = `${flag}=`;
  if (arg.startsWith(prefix)) {
    return { value: arg.slice(prefix.length), advance: 0 };
  }
  return null;
}

function tokenize(args: string[]): RawSetupArgs {
  const raw: RawSetupArgs = {
    clients: [],
    openrouterApiKey: process.env["OPENROUTER_API_KEY"] ?? "",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) {
      continue;
    }

    const clientMatch = matchFlag(arg, "--client", args, i) ?? matchFlag(arg, "-c", args, i);
    if (clientMatch !== null) {
      raw.clients.push(clientMatch.value);
      i += clientMatch.advance;
      continue;
    }

    const keyMatch = matchFlag(arg, "--openrouter-api-key", args, i);
    if (keyMatch !== null) {
      raw.openrouterApiKey = keyMatch.value;
      i += keyMatch.advance;
    }
  }

  return raw;
}

/**
 * Parse the `setup` flag set. Unknown `--client` values are reported to stderr
 * and skipped, so a typo fails loudly without aborting an otherwise valid run.
 */
export function parseSetupArgs(args: string[]): SetupArgs {
  const raw = tokenize(args);

  const validClients: ClientId[] = [];
  for (const candidate of raw.clients) {
    const parsed = ClientIdSchema.safeParse(candidate);
    if (parsed.success) {
      validClients.push(parsed.data);
    } else {
      process.stderr.write(
        `Warning: ignoring unknown --client "${candidate}". Valid: ${ClientIdSchema.options.join(", ")}\n`,
      );
    }
  }

  return {
    targetIds: validClients.length > 0 ? validClients : null,
    openrouterApiKey: raw.openrouterApiKey,
  };
}
