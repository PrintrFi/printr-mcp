export interface SetupArgs {
  /** Explicit client IDs from --client flags; null means "show interactive selection". */
  targetIds: string[] | null;
  openrouterApiKey: string;
}

function getNextArg(args: string[], index: number): string | undefined {
  return index + 1 < args.length ? args[index + 1] : undefined;
}

function handleClientArg(arg: string, args: string[], index: number, targetIds: string[]): number {
  if (arg === "--client" || arg === "-c") {
    const value = getNextArg(args, index);
    if (value) {
      targetIds.push(value);
      return index + 1;
    }
  } else if (arg.startsWith("--client=")) {
    targetIds.push(arg.slice("--client=".length));
  }
  return index;
}

function handleApiKeyArg(
  arg: string,
  args: string[],
  index: number,
): { newIndex: number; value?: string } {
  if (arg === "--openrouter-api-key") {
    const value = getNextArg(args, index);
    if (value) {
      return { newIndex: index + 1, value };
    }
  } else if (arg.startsWith("--openrouter-api-key=")) {
    return { newIndex: index, value: arg.slice("--openrouter-api-key=".length) };
  }
  return { newIndex: index };
}

export function parseSetupArgs(args: string[]): SetupArgs {
  const targetIds: string[] = [];
  let openrouterApiKey = process.env["OPENROUTER_API_KEY"] ?? "";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) {
      continue;
    }

    const newClientIndex = handleClientArg(arg, args, i, targetIds);
    if (newClientIndex !== i) {
      i = newClientIndex;
      continue;
    }

    const apiKeyResult = handleApiKeyArg(arg, args, i);
    if (apiKeyResult.value !== undefined) {
      openrouterApiKey = apiKeyResult.value;
      i = apiKeyResult.newIndex;
    }
  }

  return { targetIds: targetIds.length > 0 ? targetIds : null, openrouterApiKey };
}
