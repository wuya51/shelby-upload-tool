import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import path from 'path'
import fs from 'fs'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    open: true,
    historyApiFallback: {
      disableDotRule: true,
      // 确保 .wasm 文件不被历史回退处理
      rewrites: [
        {
          from: /^.*\.wasm$/,
          to: (context) => context.parsedUrl.pathname
        }
      ]
    },
    // 添加中间件确保 .wasm 文件有正确的 Content-Type 和路径处理
    middleware: [(req, res, next) => {
      // 处理所有 .wasm 文件请求
      if (req.url.includes('.wasm')) {
        console.log('Handling .wasm request:', req.url);
        
        // 尝试从多个可能的路径提供 wasm 文件
        const wasmPaths = [
          // 检查构建输出目录中的 wasm 文件
          path.resolve(__dirname, 'dist', 'assets', 'clay.wasm'),
          // 检查项目依赖中的 wasm 文件
          path.resolve(__dirname, 'node_modules', '@shelby-protocol', 'clay-codes', 'dist', 'clay.wasm'),
          path.resolve(__dirname, 'node_modules', '@shelby-protocol', 'sdk', 'dist', 'browser', 'clay.wasm'),
          path.resolve(__dirname, 'node_modules', '@shelby-protocol', 'sdk', 'dist', 'clay.wasm'),
          // 检查其他可能的位置
          path.resolve(__dirname, 'public', 'clay.wasm'),
          path.resolve(__dirname, 'src', 'clay.wasm')
        ];
        
        // 尝试找到存在的 wasm 文件
        let foundPath = null;
        for (const wasmPath of wasmPaths) {
          if (fs.existsSync(wasmPath)) {
            foundPath = wasmPath;
            break;
          }
        }
        
        if (foundPath) {
          console.log('Found wasm file at:', foundPath);
          res.setHeader('Content-Type', 'application/wasm');
          const wasmStream = fs.createReadStream(foundPath);
          wasmStream.pipe(res);
        } else {
          console.error('No wasm files found at expected locations');
          console.error('Searched paths:', wasmPaths);
          res.statusCode = 404;
          res.end('Wasm file not found');
        }
      } else {
        next();
      }
    }]
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'buffer': 'buffer'
    },
  },
  optimizeDeps: {
    include: ['buffer'],
    // 禁用对 @shelby-protocol/sdk 的依赖优化
    exclude: ['@shelby-protocol/sdk']
  },
  envDir: './',
  build: {
    target: 'es2020', // 支持 BigInt 等 WASM 相关特性
    rollupOptions: {
      output: {
        manualChunks: {
          'aptos-sdk': ['@aptos-labs/ts-sdk'],
          'wallet-adapter': ['@aptos-labs/wallet-adapter-core', '@aptos-labs/wallet-adapter-react']
        },
        // 为 WASM 文件禁用哈希命名
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.wasm')) {
            return 'assets/[name].wasm'; // 保持原始文件名，禁用哈希
          }
          return 'assets/[name]-[hash][extname]'; // 其他资源保持哈希命名
        }
      }
    }
  },
  // 配置 WebAssembly 加载
  assetsInclude: ['**/*.wasm']
})
