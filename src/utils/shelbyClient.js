import { ShelbyClient } from "@shelby-protocol/sdk/browser";
import { Network } from "@shelby-protocol/solana-kit/react";

/**
 * Shared Shelby client for browser-side storage interactions.
 * This client is used with React hooks from @shelby-protocol/react.
 */
export const shelbyClient = new ShelbyClient({
  network: Network.SHELBYNET,
  apiKey: import.meta.env.VITE_SHELBY_API_KEY || "",
  moduleAddress: import.meta.env.VITE_SHELBY_MODULE_ADDRESS || "0x85fdb9a176ab8ef1d9d9c1b60d60b3924f0800ac1de1cc2085fb0b8bb4988e6a",
});
