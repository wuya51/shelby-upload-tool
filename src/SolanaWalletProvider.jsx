"use client";

import { createClient, autoDiscover } from "@solana/client";
import { SolanaProvider } from "@solana/react-hooks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ShelbyClient } from "@shelby-protocol/sdk/browser";
import { Network } from "@shelby-protocol/solana-kit/react";
import React, { useState, createContext, useContext, useMemo } from "react";

const isSolanaWallet = (wallet) => {
  if (!wallet || !wallet.features) {
    return false;
  }
  return Object.keys(wallet.features).some((feature) =>
    feature.startsWith("solana:"),
  );
};

const NETWORKS = {
  mainnet: {
    endpoint: "https://api.devnet.solana.com",
    name: "Devnet"
  },
  devnet: {
    endpoint: "https://api.devnet.solana.com",
    name: "Devnet"
  },
  testnet: {
    endpoint: "https://api.devnet.solana.com",
    name: "Devnet"
  }
};

const SolanaNetworkContext = createContext(null);

export function useSolanaNetwork() {
  return useContext(SolanaNetworkContext);
}

export function SolanaWalletProvider({ children }) {
  const [currentNetwork, setCurrentNetwork] = useState('devnet');
  const [client, setClient] = useState(null);

  React.useEffect(() => {
    const networkConfig = NETWORKS[currentNetwork];
    const newClient = createClient({
      endpoint: networkConfig.endpoint,
      walletConnectors: autoDiscover({ filter: isSolanaWallet }),
    });
    setClient(newClient);
  }, [currentNetwork]);

  const queryClient = useMemo(() => new QueryClient(), [currentNetwork]);

  const shelbyClient = useMemo(() => new ShelbyClient({
    network: Network.SHELBYNET,
    apiKey: import.meta.env.VITE_SHELBY_API_KEY || '',
  }), []);

  const switchNetwork = (network) => {
    if (NETWORKS[network]) {
      setCurrentNetwork(network);
    }
  };

  const contextValue = {
    currentNetwork,
    switchNetwork,
    networks: NETWORKS,
    shelbyClient
  };

  if (!client) {
    return null;
  }

  return (
    <SolanaNetworkContext.Provider value={contextValue}>
      <QueryClientProvider client={queryClient}>
        <SolanaProvider client={client}>{children}</SolanaProvider>
      </QueryClientProvider>
    </SolanaNetworkContext.Provider>
  );
}
