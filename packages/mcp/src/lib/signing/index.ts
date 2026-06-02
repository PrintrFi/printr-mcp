export { type FakeSignerConfig, fakeSigner } from "./fake-signer.js";
export { localSigner } from "./local-signer.js";
export {
  buildEvmContractCallArgs,
  type OnchainosDeps,
  type OnchainosExec,
  onchainosChainId,
  onchainosSigner,
  parseAddressFromOutput,
  parseEvmSubmit,
} from "./onchainos-signer.js";
export { formatSignerError, type Signer, type SignerError, type SignerKind } from "./port.js";
export { type SelectSignerDeps, type SignerDescriptor, selectSigner } from "./select.js";
