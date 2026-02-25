/** @jsxImportSource react */

import { render } from "ink";
import { createElement } from "react";
import { SetupApp } from "./app.js";

export async function runSetup(args: string[]): Promise<void> {
  const { waitUntilExit } = render(createElement(SetupApp, { args }));
  await waitUntilExit();
}
