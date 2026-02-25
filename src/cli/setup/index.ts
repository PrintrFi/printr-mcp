/** @jsxImportSource react */

import { render } from "ink";
import { createElement } from "react";
import { SetupApp } from "./app.js";
import { parseSetupArgs } from "./lib/args.js";

export async function runSetup(args: string[]): Promise<void> {
  const { targetIds, openrouterApiKey } = parseSetupArgs(args);
  const { waitUntilExit } = render(
    createElement(SetupApp, { preselectedIds: targetIds, openrouterApiKey }),
  );
  await waitUntilExit();
}
