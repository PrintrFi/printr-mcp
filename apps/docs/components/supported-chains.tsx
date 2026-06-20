import { SUPPORTED_CHAINS } from "@/lib/chains.generated";

/**
 * Supported-chains table, rendered from `lib/chains.generated.ts` (generated
 * from the SDK's `CHAIN_META`). Single source of truth — adding a chain in
 * `@printr/sdk` updates this table on the next build.
 */
export function SupportedChains() {
  return (
    <table>
      <thead>
        <tr>
          <th>Chain</th>
          <th>CAIP-2</th>
          <th>Native</th>
        </tr>
      </thead>
      <tbody>
        {SUPPORTED_CHAINS.map((chain) => (
          <tr key={chain.caip2}>
            <td>{chain.name}</td>
            <td>
              <code>{chain.caip2}</code>
            </td>
            <td>{chain.symbol}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
