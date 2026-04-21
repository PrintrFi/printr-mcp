import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  formatStakingCaip10,
  listStakePositionsWithRewards,
  parseStakingCaip10,
  type SimpleStakePositionWithRewards,
  toToolResponseAsync,
} from "@printr/sdk";
import { ResultAsync } from "neverthrow";
import { z } from "zod";
import { logToolExecution } from "~/lib/logging.js";
import { getTreasuryAddress } from "~/lib/treasury.js";

const inputSchema = z.object({
  token_id: z.string().optional().describe("Telecoin ID (hex) to filter positions by. Optional."),
  owner: z
    .string()
    .optional()
    .describe(
      "CAIP-10 owner address to filter positions by. If omitted, uses treasury wallet addresses.",
    ),
  cursor: z.string().optional().describe("Pagination cursor from previous response."),
  limit: z.number().optional().describe("Maximum number of positions to return (default: 50)."),
});

const positionSchema = z.object({
  telecoin_id: z.string().describe("Telecoin ID"),
  position: z.string().optional().describe("CAIP-10 position address"),
  owner: z.string().optional().describe("CAIP-10 owner address"),
  lock_period: z.string().describe("Lock period (7_DAYS, 30_DAYS, etc.)"),
  staked_amount: z.string().optional().describe("Staked amount (display format)"),
  staked_amount_atomic: z.string().optional().describe("Staked amount (atomic)"),
  created_at: z.string().optional().describe("Position creation timestamp (ISO)"),
  unlocks_at: z.string().optional().describe("Position unlock timestamp (ISO)"),
  is_unlocked: z.boolean().describe("Whether the position is unlocked"),
  was_closed: z.boolean().describe("Whether the position was closed"),
  creation_tx: z.string().describe("Transaction ID that created this position"),
  share_in_pool_bps: z.number().optional().describe("Share in stake pool (basis points)"),
  claimable_quote_rewards: z.string().optional().describe("Claimable quote rewards (display)"),
  claimable_quote_rewards_atomic: z
    .string()
    .optional()
    .describe("Claimable quote rewards (atomic)"),
  claimable_telecoin_rewards: z
    .string()
    .optional()
    .describe("Claimable telecoin rewards (display)"),
  claimable_telecoin_rewards_atomic: z
    .string()
    .optional()
    .describe("Claimable telecoin rewards (atomic)"),
  claimed_quote_rewards: z
    .string()
    .optional()
    .describe("Historically claimed quote rewards (display)"),
  claimed_quote_rewards_atomic: z
    .string()
    .optional()
    .describe("Historically claimed quote rewards (atomic)"),
  claimed_telecoin_rewards: z
    .string()
    .optional()
    .describe("Historically claimed telecoin rewards (display)"),
  claimed_telecoin_rewards_atomic: z
    .string()
    .optional()
    .describe("Historically claimed telecoin rewards (atomic)"),
  has_claimable_rewards: z.boolean().describe("Whether position has claimable rewards"),
});

const outputSchema = z.object({
  positions: z.array(positionSchema).describe("List of staking positions with rewards"),
  total_positions: z.number().describe("Total number of positions"),
  total_with_claimable_rewards: z.number().describe("Positions with claimable rewards"),
  total_unlocked: z.number().describe("Unlocked positions ready for principal withdrawal"),
  next_cursor: z.string().optional().describe("Cursor for pagination"),
  message: z.string().describe("Status message"),
});

type CaipAccount = { chainId: string; address: string };
type OutputPosition = z.infer<typeof positionSchema>;

function defaultOwnersFromTreasury(): CaipAccount[] {
  const owners: CaipAccount[] = [];
  const evmAddress = getTreasuryAddress("evm");
  const svmAddress = getTreasuryAddress("svm");
  if (evmAddress) {
    // Default EVM chain: Base. Pass `owner` explicitly to query other EVM chains.
    owners.push({ chainId: "eip155:8453", address: evmAddress });
  }
  if (svmAddress) {
    owners.push({
      chainId: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
      address: svmAddress,
    });
  }
  return owners;
}

function hasPositiveAtomic(amount: { atomic: string } | undefined): boolean {
  if (!amount) {
    return false;
  }
  return BigInt(amount.atomic || "0") > 0n;
}

function toOutputPosition(
  pos: SimpleStakePositionWithRewards,
  now: Date,
): OutputPosition | undefined {
  const info = pos.info;
  if (!info) {
    return undefined;
  }
  const unlocksAt = info.unlocksAt ? new Date(info.unlocksAt) : undefined;
  const isUnlocked = unlocksAt ? now >= unlocksAt : false;
  const hasClaimableQuote = hasPositiveAtomic(pos.claimableQuoteRewards?.amount);
  const hasClaimableTelecoin = hasPositiveAtomic(pos.claimableTelecoinRewards?.amount);

  return {
    telecoin_id: info.telecoinId,
    position: info.position ? formatStakingCaip10(info.position) : undefined,
    owner: info.owner ? formatStakingCaip10(info.owner) : undefined,
    lock_period: info.lockPeriod,
    staked_amount: info.staked?.amount?.display,
    staked_amount_atomic: info.staked?.amount?.atomic,
    created_at: info.createdAt,
    unlocks_at: info.unlocksAt,
    is_unlocked: isUnlocked,
    was_closed: info.wasClosed,
    creation_tx: info.creationTx,
    share_in_pool_bps: info.shareInStakePoolBps,
    claimable_quote_rewards: pos.claimableQuoteRewards?.amount?.display,
    claimable_quote_rewards_atomic: pos.claimableQuoteRewards?.amount?.atomic,
    claimable_telecoin_rewards: pos.claimableTelecoinRewards?.amount?.display,
    claimable_telecoin_rewards_atomic: pos.claimableTelecoinRewards?.amount?.atomic,
    claimed_quote_rewards: pos.claimedQuoteRewards?.amount?.display,
    claimed_quote_rewards_atomic: pos.claimedQuoteRewards?.amount?.atomic,
    claimed_telecoin_rewards: pos.claimedTelecoinRewards?.amount?.display,
    claimed_telecoin_rewards_atomic: pos.claimedTelecoinRewards?.amount?.atomic,
    has_claimable_rewards: hasClaimableQuote || hasClaimableTelecoin,
  };
}

function buildMessage(total: number, withClaimable: number, unlocked: number): string {
  if (total === 0) {
    return "No staking positions found.";
  }
  const parts: string[] = [`Found ${total} staking position(s)`];
  if (withClaimable > 0) {
    parts.push(`${withClaimable} with claimable rewards`);
  }
  if (unlocked > 0) {
    parts.push(`${unlocked} unlocked`);
  }
  if (withClaimable === 0 && unlocked === 0) {
    parts.push("none with claimable rewards or unlocked");
  }
  return `${parts.join(", ")}.`;
}

async function fetchPositions(
  token_id: string | undefined,
  owner: string | undefined,
  cursor: string | undefined,
  limit: number | undefined,
): Promise<z.infer<typeof outputSchema>> {
  const owners = owner ? [parseStakingCaip10(owner)] : defaultOwnersFromTreasury();
  if (owners.length === 0) {
    throw new Error(
      "No treasury wallet configured. Use printr_set_treasury_wallet or provide an owner address.",
    );
  }

  const response = await listStakePositionsWithRewards({
    telecoinIds: token_id ? [token_id] : [],
    owners,
    ...(cursor !== undefined && { cursor }),
    ...(limit !== undefined && { limit }),
  });

  const now = new Date();
  const positions = response.positions
    .map((pos) => toOutputPosition(pos, now))
    .filter((p): p is OutputPosition => p !== undefined);

  const totalWithClaimable = positions.filter((p) => p.has_claimable_rewards).length;
  const totalUnlocked = positions.filter((p) => p.is_unlocked && !p.was_closed).length;

  return {
    positions,
    total_positions: positions.length,
    total_with_claimable_rewards: totalWithClaimable,
    total_unlocked: totalUnlocked,
    next_cursor: response.nextCursor,
    message: buildMessage(positions.length, totalWithClaimable, totalUnlocked),
  };
}

export function registerGetStakingPositionsTool(server: McpServer): void {
  server.registerTool(
    "printr_get_staking_positions",
    {
      description:
        "Get staking positions with claimable rewards. " +
        "Returns positions for the treasury wallet by default, or for a specific owner if provided. " +
        "Shows claimable and historically claimed quote/telecoin rewards for each position. " +
        "Use printr_claim_staking_rewards to claim rewards (or withdraw unlocked principal) from a position.",
      inputSchema,
      outputSchema,
    },
    logToolExecution("printr_get_staking_positions", ({ token_id, owner, cursor, limit }) =>
      toToolResponseAsync(
        ResultAsync.fromPromise(
          fetchPositions(token_id, owner, cursor, limit),
          (e) => new Error(e instanceof Error ? e.message : String(e)),
        ),
      ),
    ),
  );
}
