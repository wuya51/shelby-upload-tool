#!/usr/bin/env node
/**
 * This script fixes the SHELBY_DEPLOYER address in the SDK.
 * Vercel rebuilds node_modules during deployment, so we need to run this
 * before the build command.
 */

import fs from 'fs';
import path from 'path';

const SDK_FILE = './node_modules/@shelby-protocol/sdk/dist/chunk-SEXQTDX6.mjs';
const OLD_DEPLOYER = '0xc63d6a5efb0080a6029403131715bd4971e1149f7cc099aac69bb0069b3ddbf5';
const NEW_DEPLOYER = '0x85fdb9a176ab8ef1d9d9c1b60d60b3924f0800ac1de1cc2085fb0b8bb4988e6a';

try {
  if (!fs.existsSync(SDK_FILE)) {
    console.error('SDK file not found:', SDK_FILE);
    process.exit(1);
  }

  let content = fs.readFileSync(SDK_FILE, 'utf8');

  if (content.includes(OLD_DEPLOYER)) {
    content = content.replace(new RegExp(OLD_DEPLOYER, 'g'), NEW_DEPLOYER);
    fs.writeFileSync(SDK_FILE, content);
    console.log('✅ SDK fixed: SHELBY_DEPLOYER updated to', NEW_DEPLOYER);
  } else if (content.includes(NEW_DEPLOYER)) {
    console.log('✅ SDK already fixed');
  } else {
    console.warn('⚠️  Could not find SHELBY_DEPLOYER in SDK file');
  }
} catch (error) {
  console.error('❌ Error fixing SDK:', error.message);
  process.exit(1);
}
