import {
  type AddressLookupTableAccount,
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";

export const DEFAULT_SVM_RPC = "https://api.mainnet-beta.solana.com";

export type SvmInstruction = {
  program_id: string;
  accounts: { pubkey: string; is_signer: boolean; is_writable: boolean }[];
  data: string;
};

export type SvmPayload = {
  ixs: SvmInstruction[];
  lookup_table?: string;
  mint_address: string;
};

export type SvmSubmitResult = {
  signature: string;
  slot: number;
  confirmation_status: "finalized" | "confirmed" | "processed";
};

export async function signAndSubmitSvm(
  payload: SvmPayload,
  privateKey: string,
  rpcUrl: string = DEFAULT_SVM_RPC,
): Promise<SvmSubmitResult> {
  const connection = new Connection(rpcUrl, "confirmed");
  const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));

  const instructions = payload.ixs.map(
    (ix) =>
      new TransactionInstruction({
        programId: new PublicKey(ix.program_id),
        keys: ix.accounts.map((a) => ({
          pubkey: new PublicKey(a.pubkey),
          isSigner: a.is_signer,
          isWritable: a.is_writable,
        })),
        data: Buffer.from(ix.data, "base64"),
      }),
  );

  let altAccounts: AddressLookupTableAccount[] = [];
  if (payload.lookup_table) {
    const altResponse = await connection.getAddressLookupTable(new PublicKey(payload.lookup_table));
    if (altResponse.value) {
      altAccounts = [altResponse.value];
    }
  }

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

  const message = new TransactionMessage({
    payerKey: keypair.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message(altAccounts);

  const tx = new VersionedTransaction(message);
  tx.sign([keypair]);

  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });

  const confirmation = await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );

  if (confirmation.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
  }

  const status = await connection.getSignatureStatus(signature);
  const slot = status.context.slot;
  const confirmation_status =
    (status.value?.confirmationStatus as "finalized" | "confirmed" | "processed") ?? "confirmed";

  return { signature, slot, confirmation_status };
}
