# Shelby File Upload Tool

## 项目概述

Shelby File Upload Tool 是一个基于 React 和 Shelby Protocol SDK 开发的文件上传应用，用于将文件上传到 Shelby 网络。该应用解决了在 Vite + React 项目中使用 Shelby SDK 时遇到的各种问题，特别是 WebAssembly 编译错误和 blob 承诺处理问题。

### 核心功能

- 文件上传到 Shelby 网络
- 生成真实的 Blob Merkle Root
- 支持多钱包连接（Petra、OKX Wallet 等）
- 支持 Google 和 Apple 登录
- 显示钱包连接状态和网络信息
- 查看已上传的 Blob 文件列表

## 技术栈

- **前端框架**: React 18+
- **构建工具**: Vite 5.x
- **区块链交互**: Aptos SDK
- **文件存储**: Shelby Protocol SDK
- **路由管理**: React Router
- **钱包连接**: Aptos Wallet Adapter
- **WebAssembly**: 用于生成 Blob Merkle Root

## 安装和设置

### 1. 克隆项目

```bash
git clone <repository-url>
cd shelby
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

创建 `.env` 文件并配置以下环境变量：

```env
# Shelby 网络配置
VITE_SHELBY_NETWORK_NAME=shelbynet
VITE_SHELBY_FULLNODE=https://api.shelbynet.shelby.xyz/v1
VITE_SHELBY_API_URL=https://api.shelbynet.shelby.xyz

# API 凭证
VITE_SHELBY_API_KEY=<your-api-key>
VITE_SHELBY_BEARER_TOKEN=<your-bearer-token>

# 智能合约地址
VITE_SHELBY_MODULE_ADDRESS=0xc63d6a5efb0080a6029403131715bd4971e1149f7cc099aac69bb0069b3ddbf5
```

### 4. 启动开发服务器

```bash
npm run dev
```

## 环境变量配置

所有客户端环境变量必须使用 `VITE_` 前缀，以确保 Vite 能够正确处理它们。服务端环境变量可以使用 `SHELBY_` 前缀。

### 重要环境变量说明

- **VITE_SHELBY_API_KEY**: Shelby API 密钥，用于与 Shelby 网络交互
- **VITE_SHELBY_BEARER_TOKEN**: Bearer 令牌，用于认证 API 请求
- **VITE_SHELBY_MODULE_ADDRESS**: Blob 元数据智能合约地址
- **VITE_SHELBY_FULLNODE**: Shelby 网络全节点 URL

## 功能说明

### 上传流程

1. **准备上传**: 选择文件，设置 Blob 名称和过期时间
2. **生成 Blob Merkle Root**: 使用 Shelby SDK 生成文件的 Merkle Root
3. **提交交易**: 向区块链提交注册 Blob 的交易
4. **等待交易确认**: 等待交易在链上完成
5. **上传文件数据**: 使用多部分上传将文件数据上传到 Shelby 网络

### 钱包连接

- 支持多种钱包连接方式，包括 Petra、OKX Wallet 等
- 支持 Google 和 Apple 登录
- 显示钱包缩略地址和网络状态

### Blob 管理

- 查看已上传的 Blob 文件列表
- 显示 Blob 文件的详细信息

## 遇到的问题及其解决方案

### 1. WebAssembly 编译错误

**问题**: 
```
WebAssembly.compile(): expected magic word 00 61 73 6d, found 3c 21 64 6f @+0
```

**原因**: 
Vite 依赖优化器处理 SDK 时，无法正确解析嵌套的 WASM 依赖，返回 HTML 而非 WASM 文件。

**解决方案**: 
- 使用动态导入 `ShelbyClient`
- 禁用 Vite 依赖优化器对 `@shelby-protocol/sdk` 的处理
- 配置 Vite 正确处理 WASM 文件

**代码示例**: 
```javascript
// 动态导入 ShelbyClient
const { ShelbyClient } = await import("@shelby-protocol/sdk/browser");
```

### 2. Blob 承诺长度无效错误

**问题**: 
```
Simulation error: The blob commitment length is invalid (must be exactly 32 bytes)
```

**原因**: 
传递给智能合约的 blob 承诺格式不正确，需要 32 字节的数组格式。

**解决方案**: 
- 将 hex 格式的 blob_merkle_root 转换为 32 字节的 Uint8Array
- 确保转换过程正确处理 hex 字符串

**代码示例**: 
```javascript
// 将 hex 格式的 blob_merkle_root 转换为 32 字节的 Uint8Array
const blobMerkleRootHex = blobCommitments.blob_merkle_root;
const cleanHex = blobMerkleRootHex.startsWith('0x') ? blobMerkleRootHex.slice(2) : blobMerkleRootHex;

// 确保长度是 64 个字符（32 字节）
if (cleanHex.length !== 64) {
  throw new Error(`Invalid blob_merkle_root length: expected 64 hex characters, got ${cleanHex.length}`);
}

// 转换为 Uint8Array
const blobMerkleRootBytes = new Uint8Array(32);
for (let i = 0; i < 32; i++) {
  blobMerkleRootBytes[i] = parseInt(cleanHex.substring(i * 2, i * 2 + 2), 16);
}

// 构建交易 payload 时使用正确的格式
const transactionPayload = {
  sender: currentUploadData.parsedAddress,
  data: {
    function: `${currentUploadData.moduleAddress}::blob_metadata::register_multiple_blobs`,
    functionArguments: [
      [currentUploadData.uniqueBlobName],
      currentUploadData.expirationMicros.toString(),
      [Array.from(blobMerkleRootBytes)], // 使用 32 字节数组格式
      ["1"],
      [currentUploadData.fileSize.toString()],
      "0",
      "0"
    ]
  }
};
```

### 3. 多部分上传失败

**问题**: 
```
Failed to complete multipart upload! status: 400, body: {"error":"Bad Request"}
```

**原因**: 
- 使用了错误的 API 路径
- 认证 token 格式不正确

**解决方案**: 
- 使用正确的 API 路径，包含 `/shelby/v1/` 前缀
- 使用 Bearer token 而非 API key 进行认证

**代码示例**: 
```javascript
// 构建完整的请求URL
const startUrl = new URL("/shelby/v1/multipart-uploads", baseUrl).toString();

// 使用 Bearer token 进行认证
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

### 4. 交易验证失败

**问题**: 
```
Transaction verification failed: undefined
```

**原因**: 
错误对象没有 `message` 属性，或者是字符串类型的错误。

**解决方案**: 
- 改进错误处理逻辑，处理字符串错误和对象错误
- 提供更详细的错误信息

**代码示例**: 
```javascript
// 处理字符串错误和对象错误
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

### 5. 钱包地址解析错误

**问题**: 
```
TypeError: account.address.slice is not a function
```

**原因**: 
`account.address` 可能不是字符串类型，而是其他格式的地址对象。

**解决方案**: 
- 添加 `parseAddress` 函数，处理不同类型的地址格式

**代码示例**: 
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

## 代码示例

### 生成 Blob Merkle Root

```javascript
// 生成真实的 Blob Merkle Root
const { ClayErasureCodingProvider, generateCommitments } = await import("@shelby-protocol/sdk/browser");

const provider = await ClayErasureCodingProvider.create();
const blobCommitments = await generateCommitments(provider, fileData);

// 转换为 32 字节的 Uint8Array
const blobMerkleRootHex = blobCommitments.blob_merkle_root;
const cleanHex = blobMerkleRootHex.startsWith('0x') ? blobMerkleRootHex.slice(2) : blobMerkleRootHex;

const blobMerkleRootBytes = new Uint8Array(32);
for (let i = 0; i < 32; i++) {
  blobMerkleRootBytes[i] = parseInt(cleanHex.substring(i * 2, i * 2 + 2), 16);
}
```

### 上传文件

```javascript
// 创建 ShelbyClient 实例
const shelbyClient = new ShelbyClient({
  network: 'shelbynet',
  apiKey: SHELBY_BEARER_TOKEN
});

// 上传文件数据
// 这里使用了自定义的多部分上传实现
// 因为直接使用 client.upload() 方法可能会遇到认证问题
```

### 钱包连接

```javascript
// 连接钱包
const handleConnect = async (walletName) => {
  try {
    await connect(walletName);
    setShowConnectMenu(false);
  } catch (error) {
    console.error('Error connecting to wallet:', error);
  }
};

// 显示连接状态
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
  // 显示连接按钮
);
```

## 最佳实践

### 1. 使用动态导入 Shelby SDK

在 Vite + React 项目中，直接导入 Shelby SDK 会导致 WebAssembly 编译错误。因此，建议使用动态导入：

```javascript
// 正确的做法
const { ShelbyClient } = await import("@shelby-protocol/sdk/browser");

// 错误的做法
// import { ShelbyClient } from "@shelby-protocol/sdk/browser";
```

### 2. 正确配置 Vite

在 `vite.config.js` 中添加以下配置，以确保正确处理 WASM 文件：

```javascript
export default defineConfig({
  optimizeDeps: {
    include: ['buffer'],
    exclude: ['@shelby-protocol/sdk'] // 禁用对 SDK 的依赖优化
  },
  build: {
    target: 'es2020', // 支持 WASM + BigInt
    assetsInlineLimit: 0, // 不要把 .wasm 内联成 base64
  },
  // 配置 WebAssembly 加载
  assetsInclude: ['**/*.wasm']
});
```

### 3. 生成真实的 Blob Merkle Root

不要使用空承诺，而是使用 Shelby SDK 生成真实的 Blob Merkle Root：

```javascript
const { ClayErasureCodingProvider, generateCommitments } = await import("@shelby-protocol/sdk/browser");
const provider = await ClayErasureCodingProvider.create();
const blobCommitments = await generateCommitments(provider, fileData);
```

### 4. 正确处理 Blob 承诺格式

确保将 blob_merkle_root 转换为 32 字节的 Uint8Array 格式：

```javascript
const blobMerkleRootHex = blobCommitments.blob_merkle_root;
const cleanHex = blobMerkleRootHex.startsWith('0x') ? blobMerkleRootHex.slice(2) : blobMerkleRootHex;

const blobMerkleRootBytes = new Uint8Array(32);
for (let i = 0; i < 32; i++) {
  blobMerkleRootBytes[i] = parseInt(cleanHex.substring(i * 2, i * 2 + 2), 16);
}
```

### 5. 使用正确的 API 路径和认证方式

使用包含 `/shelby/v1/` 前缀的 API 路径，并使用 Bearer token 进行认证：

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

### 6. 改进错误处理

提供更详细的错误信息，处理不同类型的错误：

```javascript
// 处理字符串错误和对象错误
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

## 总结

Shelby File Upload Tool 成功解决了在 Vite + React 项目中使用 Shelby SDK 时遇到的各种问题，特别是 WebAssembly 编译错误和 blob 承诺处理问题。通过本文档的指导，您应该能够正确配置和使用 Shelby SDK 来上传文件到 Shelby 网络。

如果您遇到任何其他问题，请参考 Shelby Protocol 的官方文档或在 GitHub 上提交 issue。