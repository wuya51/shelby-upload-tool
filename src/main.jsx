import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import './index.css'
import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react'
import { Network } from '@aptos-labs/ts-sdk'
import { SolanaWalletProvider } from './SolanaWalletProvider.jsx'

import { Buffer } from 'buffer'
globalThis.Buffer = Buffer

if (!Object.prototype.toStringLongWithoutPrefix) {
  Object.defineProperty(Object.prototype, 'toStringLongWithoutPrefix', {
    value: function() {
      if (this.address && typeof this.address === 'string') {
        return this.address.startsWith('0x') ? this.address.slice(2) : this.address;
      } else if (this.account && typeof this.account === 'string') {
        return this.account.startsWith('0x') ? this.account.slice(2) : this.account;
      } else if (typeof this === 'string') {
        return this.startsWith('0x') ? this.slice(2) : this;
      }
      return '';
    },
    writable: false,
    enumerable: false,
    configurable: true
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'))

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AptosWalletAdapterProvider
        dappConfig={{
          networkName: 'custom',
          aptosApiKey: import.meta.env.VITE_APTOS_API_KEY || ''
        }}
        plugins={[]}
        autoConnect={false}
        onError={() => {
        }}
      >
        <SolanaWalletProvider>
          <App />
        </SolanaWalletProvider>
      </AptosWalletAdapterProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
