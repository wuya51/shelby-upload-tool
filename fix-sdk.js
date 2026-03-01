#!/usr/bin/env node
/**
 * This script fixes the SHELBY_DEPLOYER address in the SDK.
 * Vercel rebuilds node_modules during deployment, so we need to run this
 * before the build command.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default deployer address from SDK
const OLD_DEPLOYER = '0xc63d6a5efb0080a6029403131715bd4971e1149f7cc099aac69bb0069b3ddbf5';

// Read from .env file if exists
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

// Read from environment variable or .env file
const NEW_DEPLOYER = process.env.VITE_SHELBY_MODULE_ADDRESS || loadEnvFile();

console.log('🔧 Fix SDK Script Starting...');
console.log('Current directory:', process.cwd());
console.log('Script directory:', __dirname);
console.log('Environment VITE_SHELBY_MODULE_ADDRESS:', process.env.VITE_SHELBY_MODULE_ADDRESS);
console.log('Loaded from .env:', loadEnvFile());
console.log('Final NEW_DEPLOYER:', NEW_DEPLOYER);

if (!NEW_DEPLOYER) {
  console.error('❌ VITE_SHELBY_MODULE_ADDRESS is not set');
  console.error('Please set it in your .env file or Vercel environment variables');
  process.exit(1);
}

// Try multiple possible paths for the SDK
const POSSIBLE_PATHS = [
  './node_modules/@shelby-protocol/sdk/dist',
  path.join(__dirname, 'node_modules/@shelby-protocol/sdk/dist'),
  '/vercel/path0/node_modules/@shelby-protocol/sdk/dist',
  process.cwd() + '/node_modules/@shelby-protocol/sdk/dist',
];

let sdkDir = null;

// Find the SDK directory
for (const tryPath of POSSIBLE_PATHS) {
  console.log('Checking path:', tryPath);
  if (fs.existsSync(tryPath)) {
    console.log('✅ Found SDK at:', tryPath);
    sdkDir = tryPath;
    break;
  }
}

if (!sdkDir) {
  console.error('❌ Could not find SDK directory in any of the expected paths');
  console.error('Searched paths:', POSSIBLE_PATHS);
  process.exit(1);
}

try {
  // Find all chunk files
  const files = fs.readdirSync(sdkDir);
  const chunkFiles = files.filter(f => f.startsWith('chunk-') && f.endsWith('.mjs'));
  
  console.log(`\nFound ${chunkFiles.length} chunk files to check`);

  let fixedCount = 0;
  let alreadyFixedCount = 0;
  let notFoundCount = 0;

  for (const file of chunkFiles) {
    const filePath = path.join(sdkDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    if (content.includes(OLD_DEPLOYER)) {
      content = content.replace(new RegExp(OLD_DEPLOYER, 'g'), NEW_DEPLOYER);
      fs.writeFileSync(filePath, content);
      console.log('✅ Fixed:', file);
      fixedCount++;
    } else if (content.includes(NEW_DEPLOYER)) {
      console.log('✓ Already fixed:', file);
      alreadyFixedCount++;
    } else {
      notFoundCount++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`  Fixed: ${fixedCount}`);
  console.log(`  Already fixed: ${alreadyFixedCount}`);
  console.log(`  No deployer found: ${notFoundCount}`);

  if (fixedCount === 0 && alreadyFixedCount === 0) {
    console.error('❌ Could not find SHELBY_DEPLOYER in any SDK file');
    process.exit(1);
  }
  
  console.log('\n✅ SDK fix completed successfully!');
} catch (error) {
  console.error('❌ Error fixing SDK:', error.message);
  console.error(error.stack);
  process.exit(1);
}
