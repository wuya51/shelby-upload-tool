#!/usr/bin/env node
/**
 * This script fixes the SHELBY_DEPLOYER address in the built dist files.
 * This runs after Vite build to ensure the deployer address is correct in the bundled output.
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
  console.log('Checking .env file:', envPath);
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

console.log('🔧 Fix Dist Files Script Starting...');
console.log('Current directory:', process.cwd());
console.log('Environment VITE_SHELBY_MODULE_ADDRESS:', process.env.VITE_SHELBY_MODULE_ADDRESS);
console.log('Loaded from .env:', loadEnvFile());
console.log('Final NEW_DEPLOYER:', NEW_DEPLOYER);

if (!NEW_DEPLOYER) {
  console.error('❌ VITE_SHELBY_MODULE_ADDRESS is not set');
  console.error('Please set it in your .env file or Vercel environment variables');
  process.exit(1);
}

// Find dist directory
const distDir = path.join(process.cwd(), 'dist');

if (!fs.existsSync(distDir)) {
  console.error('❌ Dist directory not found:', distDir);
  process.exit(1);
}

console.log('Dist directory:', distDir);

// Find all JS files in dist/assets
const assetsDir = path.join(distDir, 'assets');
if (!fs.existsSync(assetsDir)) {
  console.error('❌ Assets directory not found:', assetsDir);
  process.exit(1);
}

console.log('Assets directory:', assetsDir);

const files = fs.readdirSync(assetsDir);
const jsFiles = files.filter(f => f.endsWith('.js'));

console.log(`\n=== Files in assets directory ===`);
console.log('Total files:', files.length);
console.log('JS files:', jsFiles.length);
console.log('JS file names:', jsFiles);

let fixedCount = 0;
let alreadyFixedCount = 0;
let notFoundCount = 0;

console.log('\n=== Processing JS files ===');
for (const file of jsFiles) {
  const filePath = path.join(assetsDir, file);
  console.log('Processing:', file);
  
  let content = fs.readFileSync(filePath, 'utf8');

  if (content.includes(OLD_DEPLOYER)) {
    content = content.replace(new RegExp(OLD_DEPLOYER, 'g'), NEW_DEPLOYER);
    fs.writeFileSync(filePath, content);
    console.log('  ✅ Fixed:', file);
    fixedCount++;
  } else if (content.includes(NEW_DEPLOYER)) {
    console.log('  ✓ Already fixed:', file);
    alreadyFixedCount++;
  } else {
    console.log('  - No deployer found:', file);
    notFoundCount++;
  }
}

console.log('\n=== Summary ===');
console.log('  Fixed:', fixedCount);
console.log('  Already fixed:', alreadyFixedCount);
console.log('  No deployer found:', notFoundCount);

if (fixedCount === 0 && alreadyFixedCount === 0) {
  console.warn('⚠️  Could not find SHELBY_DEPLOYER in any dist file');
} else {
  console.log('\n✅ Dist files fix completed successfully!');
}
