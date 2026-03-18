export interface SetupArgs {
  /** Explicit client IDs from --client flags; null means "show interactive selection". */
  targetIds: string[] | null;
  openrouterApiKey: string;
}

export function parseSetupArgs(args: string[]): SetupArgs {
  const targetIds: string[] = [];
  let openrouterApiKey = process.env.OPENROUTER_API_KEY ?? "";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if ((arg === "--client" || arg === "-c") && args[i + 1]) {
      targetIds.push(args[++i]!);
    } else if (arg.startsWith("--client=")) {
      targetIds.push(arg.slice("--client=".length));
    } else if (arg === "--openrouter-api-key" && args[i + 1]) {
      openrouterApiKey = args[++i]!;
    } else if (arg.startsWith("--openrouter-api-key=")) {
      openrouterApiKey = arg.slice("--openrouter-api-key=".length);
    }
  }

  return { targetIds: targetIds.length > 0 ? targetIds : null, openrouterApiKey };
}
