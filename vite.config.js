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
      rewrites: [
        {
          from: /^.*\.wasm$/,
          to: (context) => context.parsedUrl.pathname
        }
      ]
    },
    middleware: [(req, res, next) => {
      if (req.url.includes('.wasm')) {
        console.log('Handling .wasm request:', req.url);
        
        const wasmPaths = [
          path.resolve(__dirname, 'dist', 'assets', 'clay.wasm'),
          path.resolve(__dirname, 'node_modules', '@shelby-protocol', 'clay-codes', 'dist', 'clay.wasm'),
          path.resolve(__dirname, 'node_modules', '@shelby-protocol', 'sdk', 'dist', 'browser', 'clay.wasm'),
          path.resolve(__dirname, 'node_modules', '@shelby-protocol', 'sdk', 'dist', 'clay.wasm'),
          path.resolve(__dirname, 'public', 'clay.wasm'),
          path.resolve(__dirname, 'src', 'clay.wasm')
        ];
        
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
    exclude: ['@shelby-protocol/sdk']
  },
  envDir: './',
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          'aptos-sdk': ['@aptos-labs/ts-sdk'],
          'wallet-adapter': ['@aptos-labs/wallet-adapter-core', '@aptos-labs/wallet-adapter-react']
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.wasm')) {
            return 'assets/[name].wasm';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    }
  },
  assetsInclude: ['**/*.wasm']
})
