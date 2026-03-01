import { ShelbyClient } from "@shelby-protocol/sdk/browser";
import { Network } from "@shelby-protocol/solana-kit/react";
import { AccountAddress } from "@aptos-labs/ts-sdk";

/**
 * Shared Shelby client for browser-side storage interactions.
 * This client is used with React hooks from @shelby-protocol/react.
 */
const moduleAddress = import.meta.env.VITE_SHELBY_MODULE_ADDRESS;

export const shelbyClient = new ShelbyClient({
  network: Network.SHELBYNET,
  apiKey: import.meta.env.VITE_SHELBY_API_KEY,
  deployer: moduleAddress ? AccountAddress.fromString(moduleAddress) : undefined,
});
