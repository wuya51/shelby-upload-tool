import fs from 'fs';
import path from 'path';

const OLD_DEPLOYER = '0xc63d6a5efb0080a6029403131715bd4971e1149f7cc099aac69bb0069b3ddbf5';

function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const match = line.match(/^VITE_SHELBY_MODULE_ADDRESS=(.+)$/);
      if (match) {
        return match[1].trim();
      }
    }
  }
  return null;
}

function findSdkInPnpm() {
  const pnpmDir = path.join(process.cwd(), 'node_modules/.pnpm');
  if (!fs.existsSync(pnpmDir)) {
    return null;
  }
  
  const entries = fs.readdirSync(pnpmDir);
  for (const entry of entries) {
    if (entry.startsWith('@shelby-protocol+sdk@')) {
      const sdkDist = path.join(pnpmDir, entry, 'node_modules/@shelby-protocol/sdk/dist');
      if (fs.existsSync(sdkDist)) {
        return sdkDist;
      }
    }
  }
  return null;
}

export default function fixSdkPlugin() {
  return {
    name: 'fix-sdk-plugin',
    buildStart() {
      const NEW_DEPLOYER = process.env.VITE_SHELBY_MODULE_ADDRESS || loadEnvFile();
      
      if (!NEW_DEPLOYER) {
        console.error('❌ VITE_SHELBY_MODULE_ADDRESS is not set');
        return;
      }

      console.log('🔧 Vite Plugin: Fixing SDK...');
      console.log('NEW_DEPLOYER:', NEW_DEPLOYER);

      let sdkDir = findSdkInPnpm();
      
      if (!sdkDir) {
        const possiblePaths = [
          './node_modules/@shelby-protocol/sdk/dist',
          process.cwd() + '/node_modules/@shelby-protocol/sdk/dist',
        ];
        
        for (const tryPath of possiblePaths) {
          if (fs.existsSync(tryPath)) {
            sdkDir = tryPath;
            break;
          }
        }
      }
      
      if (!sdkDir) {
        console.error('❌ SDK directory not found');
        return;
      }

      console.log('SDK directory:', sdkDir);

      const files = fs.readdirSync(sdkDir);
      const chunkFiles = files.filter(f => f.startsWith('chunk-') && f.endsWith('.mjs'));
      
      let fixedCount = 0;

      for (const file of chunkFiles) {
        const filePath = path.join(sdkDir, file);
        let content = fs.readFileSync(filePath, 'utf8');

        if (content.includes(OLD_DEPLOYER)) {
          content = content.replace(new RegExp(OLD_DEPLOYER, 'g'), NEW_DEPLOYER);
          fs.writeFileSync(filePath, content);
          console.log('✅ Fixed:', file);
          fixedCount++;
        }
      }

      console.log(`✅ SDK fix completed: ${fixedCount} files fixed`);
    }
  };
}
