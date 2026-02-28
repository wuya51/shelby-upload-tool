# Shelby File Upload Tool

## Project Overview

Shelby File Upload Tool is a file upload application developed based on React and Shelby Protocol SDK, designed to upload files to the Shelby network. This application addresses various issues encountered when using Shelby SDK in Vite + React projects, particularly WebAssembly compilation errors and blob commitment handling problems.

### Core Features

- Upload files to Shelby network
- Generate real Blob Merkle Root
- Support multiple wallet connections (Petra, OKX Wallet, Phantom, Solflare, etc.)
- Display wallet connection status and network information
- View uploaded Blob files list
- Support both Aptos and Solana wallets

## Technology Stack

- **Frontend Framework**: React 18+
- **Build Tool**: Vite 5.x
- **Blockchain Interaction**: Aptos SDK, Solana Web3.js
- **File Storage**: Shelby Protocol SDK
- **Routing Management**: React Router
- **Wallet Connection**: Aptos Wallet Adapter, Solana Wallet Adapter
- **WebAssembly**: Used for generating Blob Merkle Root

## Installation and Setup

### 1. Clone the Project

```bash
git clone <repository-url>
cd shelby
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file and configure the following environment variables:

```env
# Shelby Network Configuration
VITE_SHELBY_NETWORK_NAME=shelbynet
VITE_SHELBY_FULLNODE=https://api.shelbynet.shelby.xyz/v1
VITE_SHELBY_API_URL=https://api.shelbynet.shelby.xyz

# API Credentials
VITE_SHELBY_API_KEY=<your-api-key>
VITE_SHELBY_BEARER_TOKEN=<your-bearer-token>

# Smart Contract Address
VITE_SHELBY_MODULE_ADDRESS=0x85fdb9a176ab8ef1d9d9c1b60d60b3924f0800ac1de1cc2085fb0b8bb4988e6a
```

## Environment Variable Configuration

All client-side environment variables must use the `VITE_` prefix to ensure Vite can process them correctly. Server-side environment variables can use the `SHELBY_` prefix.

### Important Environment Variables

- **VITE_SHELBY_API_KEY**: Shelby API key for interacting with the Shelby network
- **VITE_SHELBY_BEARER_TOKEN**: Bearer token for authenticating API requests
- **VITE_SHELBY_MODULE_ADDRESS**: Blob metadata smart contract address
- **VITE_SHELBY_FULLNODE**: Shelby network fullnode URL

## Feature Description

### Upload Process

1. **Prepare Upload**: Select a file, set Blob name and expiration time
2. **Generate Blob Merkle Root**: Use Shelby SDK to generate the file's Merkle Root
3. **Submit Transaction**: Submit a transaction to register the Blob to the blockchain
4. **Wait for Transaction Confirmation**: Wait for the transaction to complete on-chain
5. **Upload File Data**: Use multipart upload to upload file data to the Shelby network

**Aptos Wallet Upload Process**:
1. Select file and prepare upload
2. View upload details (file size, blob name, expiration time)
3. Submit transaction and sign with Aptos wallet
4. Wait for transaction confirmation

**Solana Wallet Upload Process**:
1. Select file and prepare upload
2. Network warning modal appears (requires Solana Devnet)
3. Choose to cancel or confirm upload
4. Sign transaction with Solana wallet
5. Upload file directly using Shelby Protocol SDK

### Wallet Connection

- Support multiple wallet connection methods, including Petra, OKX Wallet, Phantom, Solflare, etc.
- Display wallet truncated address and network status
- Support both Aptos and Solana wallets
- Solana wallet network warning modal (requires Solana Devnet)

### Blob Management

- View uploaded Blob files list
- Display detailed information about Blob files

## Issues Encountered and Their Solutions

### 1. WebAssembly Compilation Error

**Problem**:
```
WebAssembly.compile(): expected magic word 00 61 73 6d, found 3c 21 64 6f @+0
```

**Cause**:
When Vite dependency optimizer processes the SDK, it cannot correctly resolve nested WASM dependencies, returning HTML instead of WASM files.

**Solution**:
- Use dynamic import for `ShelbyClient`
- Disable Vite dependency optimizer for `@shelby-protocol/sdk`
- Configure Vite to correctly handle WASM files

**Code Example**:
```javascript
// Dynamically import ShelbyClient
const { ShelbyClient } = await import("@shelby-protocol/sdk/browser");
```

### 2. Invalid Blob Commitment Length Error

**Problem**:
```
Simulation error: The blob commitment length is invalid (must be exactly 32 bytes)
```

**Cause**:
The blob commitment format passed to the smart contract is incorrect, requiring a 32-byte array format.

**Solution**:
- Convert hex format blob_merkle_root to 32-byte Uint8Array
- Ensure the conversion process correctly handles hex strings

**Code Example**:
```javascript
// Convert hex format blob_merkle_root to 32-byte Uint8Array
const blobMerkleRootHex = blobCommitments.blob_merkle_root;
const cleanHex = blobMerkleRootHex.startsWith('0x') ? blobMerkleRootHex.slice(2) : blobMerkleRootHex;

// Ensure length is 64 characters (32 bytes)
if (cleanHex.length !== 64) {
  throw new Error(`Invalid blob_merkle_root length: expected 64 hex characters, got ${cleanHex.length}`);
}

// Convert to Uint8Array
const blobMerkleRootBytes = new Uint8Array(32);
for (let i = 0; i < 32; i++) {
  blobMerkleRootBytes[i] = parseInt(cleanHex.substring(i * 2, i * 2 + 2), 16);
}

// Use correct format when building transaction payload
const transactionPayload = {
  sender: currentUploadData.parsedAddress,
  data: {
    function: `${currentUploadData.moduleAddress}::blob_metadata::register_multiple_blobs`,
    functionArguments: [
      [currentUploadData.uniqueBlobName],
      currentUploadData.expirationMicros.toString(),
      [Array.from(blobMerkleRootBytes)], // Use 32-byte array format
      ["1"],
      [currentUploadData.fileSize.toString()],
      "0",
      "0"
    ]
  }
};
```

### 3. Multipart Upload Failure

**Problem**:
```
Failed to complete multipart upload! status: 400, body: {"error":"Bad Request"}
```

**Cause**:
- Using incorrect API path
- Incorrect authentication token format

**Solution**:
- Use correct API path with `/shelby/v1/` prefix
- Use Bearer token instead of API key for authentication

**Code Example**:
```javascript
// Build complete request URL
const startUrl = new URL("/shelby/v1/multipart-uploads", baseUrl).toString();

// Use Bearer token for authentication
const startResponse = await fetch(startUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${SHELBY_BEARER_TOKEN}`
  },
  body: JSON.stringify({
    rawAccount: account.toString(),
    rawBlobName: blobName,
    rawPartSize: partSize
  })
});
```

### 4. Transaction Verification Failure

**Problem**:
```
Transaction verification failed: undefined
```

**Cause**:
Error object has no `message` property, or is a string-type error.

**Solution**:
- Improve error handling logic to handle string errors and object errors
- Provide more detailed error information

**Code Example**:
```javascript
// Handle string errors and object errors
let errorMessage;
if (typeof error === 'string') {
  errorMessage = error;
} else if (error instanceof Error && error.message) {
  errorMessage = error.message;
} else if (error.toString) {
  errorMessage = error.toString();
} else {
  errorMessage = 'Unknown error';
}

showMessage('Transaction verification failed: ' + errorMessage, 'error');
```

### 5. Wallet Address Parsing Error

**Problem**:
```
TypeError: account.address.slice is not a function
```

**Cause**:
`account.address` may not be a string type, but other format address object.

**Solution**:
- Add `parseAddress` function to handle different address formats

**Code Example**:
```javascript
const parseAddress = (address) => {
  if (!address) return null;
  if (typeof address === 'string') return address;
  if (address.data && Array.isArray(address.data)) {
    const hex = address.data.map(byte => byte.toString(16).padStart(2, '0')).join('');
    return `0x${hex}`;
  }
  if (typeof address.toString === 'function') {
    return address.toString();
  }
  return JSON.stringify(address);
};
```

## Code Examples

### Generate Blob Merkle Root

```javascript
// Generate real Blob Merkle Root
const { ClayErasureCodingProvider, generateCommitments } = await import("@shelby-protocol/sdk/browser");

const provider = await ClayErasureCodingProvider.create();
const blobCommitments = await generateCommitments(provider, fileData);

// Convert to 32-byte Uint8Array
const blobMerkleRootHex = blobCommitments.blob_merkle_root;
const cleanHex = blobMerkleRootHex.startsWith('0x') ? blobMerkleRootHex.slice(2) : blobMerkleRootHex;

const blobMerkleRootBytes = new Uint8Array(32);
for (let i = 0; i < 32; i++) {
  blobMerkleRootBytes[i] = parseInt(cleanHex.substring(i * 2, i * 2 + 2), 16);
}
```

### Wallet Connection

```javascript
// Connect wallet
const handleConnect = async (walletName) => {
  try {
    await connect(walletName);
    setShowConnectMenu(false);
  } catch (error) {
    console.error('Error connecting to wallet:', error);
  }
};

// Display connection status
{connected ? (
  <div className="flex items-center space-x-2">
    <div className="text-right">
      <div className="text-xs text-gray-300 font-mono">
        {parseAddress(account.address) ? `${parseAddress(account.address).slice(0, 6)}...${parseAddress(account.address).slice(-4)}` : 'Invalid Address'}
      </div>
      <div className="flex items-center justify-end text-xs">
        <span className={`mr-1 ${network?.name === 'custom' ? 'text-green-400' : 'text-yellow-400'}`}>
          {network?.name === 'custom' ? 'shelbynet' : network?.name || 'Unknown Network'}
        </span>
        <span className={`${network?.name === 'custom' ? 'text-green-400' : 'text-yellow-400'}`}>
          {network?.name === 'custom' ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          )}
        </span>
      </div>
    </div>
    <button
      onClick={disconnect}
      className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
    >
      Disconnect
    </button>
  </div>
) : (
  // Show connect button
);
```

## Best Practices

### 1. Use Dynamic Import for Shelby SDK

In Vite + React projects, directly importing Shelby SDK can cause WebAssembly compilation errors. Therefore, it's recommended to use dynamic import:

```javascript
// Correct approach
const { ShelbyClient } = await import("@shelby-protocol/sdk/browser");

// Incorrect approach
// import { ShelbyClient } from "@shelby-protocol/sdk/browser";
```

### 2. Configure Vite Correctly

Add the following configuration to `vite.config.js` to ensure proper handling of WASM files:

```javascript
export default defineConfig({
  optimizeDeps: {
    include: ['buffer'],
    exclude: ['@shelby-protocol/sdk'] // Disable dependency optimization for SDK
  },
  build: {
    target: 'es2020', // Support WASM + BigInt
    assetsInlineLimit: 0, // Don't inline .wasm as base64
  },
  // Configure WebAssembly loading
  assetsInclude: ['**/*.wasm']
});
```

### 3. Generate Real Blob Merkle Root

Don't use empty commitments; instead, use Shelby SDK to generate real Blob Merkle Root:

```javascript
const { ClayErasureCodingProvider, generateCommitments } = await import("@shelby-protocol/sdk/browser");
const provider = await ClayErasureCodingProvider.create();
const blobCommitments = await generateCommitments(provider, fileData);
```

### 4. Handle Blob Commitment Format Correctly

Ensure blob_merkle_root is converted to 32-byte Uint8Array format:

```javascript
const blobMerkleRootHex = blobCommitments.blob_merkle_root;
const cleanHex = blobMerkleRootHex.startsWith('0x') ? blobMerkleRootHex.slice(2) : blobMerkleRootHex;

const blobMerkleRootBytes = new Uint8Array(32);
for (let i = 0; i < 32; i++) {
  blobMerkleRootBytes[i] = parseInt(cleanHex.substring(i * 2, i * 2 + 2), 16);
}
```

### 5. Use Correct API Path and Authentication

Use API path with `/shelby/v1/` prefix and authenticate with Bearer token:

```javascript
const startUrl = new URL("/shelby/v1/multipart-uploads", baseUrl).toString();

const startResponse = await fetch(startUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${SHELBY_BEARER_TOKEN}`
  },
  // ...
});
```

### 6. Improve Error Handling

Provide more detailed error information and handle different types of errors:

```javascript
// Handle string errors and object errors
let errorMessage;
if (typeof error === 'string') {
  errorMessage = error;
} else if (error instanceof Error && error.message) {
  errorMessage = error.message;
} else if (error.toString) {
  errorMessage = error.toString();
} else {
  errorMessage = 'Unknown error';
}
```

## Summary

Shelby File Upload Tool successfully addresses various issues encountered when using Shelby SDK in Vite + React projects, particularly WebAssembly compilation errors and blob commitment handling problems. With the guidance provided in this document, you should be able to correctly configure and use Shelby SDK to upload files to the Shelby network.

If you encounter any other issues, please refer to Shelby Protocol's official documentation or submit an issue on GitHub.
