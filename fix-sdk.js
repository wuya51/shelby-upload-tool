#!/usr/bin/env node
/**
 * This script fixes the SHELBY_DEPLOYER address in the SDK.
 * Vercel rebuilds node_modules during deployment, so we need to run this
 * before the build command.
 */

import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';

const SDK_DIR = './node_modules/@shelby-protocol/sdk/dist';
const OLD_DEPLOYER = '0xc63d6a5efb0080a6029403131715bd4971e1149f7cc099aac69bb0069b3ddbf5';
const NEW_DEPLOYER = '0x85fdb9a176ab8ef1d9d9c1b60d60b3924f0800ac1de1cc2085fb0b8bb4988e6a';

try {
  // Find all chunk files that may contain SHELBY_DEPLOYER
  const chunkFiles = globSync(`${SDK_DIR}/chunk-*.mjs`);
  
  if (chunkFiles.length === 0) {
    console.error('❌ No SDK chunk files found in:', SDK_DIR);
    process.exit(1);
  }

  console.log(`Found ${chunkFiles.length} chunk files to check`);

  let fixedCount = 0;
  let alreadyFixedCount = 0;
  let notFoundCount = 0;

  for (const file of chunkFiles) {
    let content = fs.readFileSync(file, 'utf8');

    if (content.includes(OLD_DEPLOYER)) {
      content = content.replace(new RegExp(OLD_DEPLOYER, 'g'), NEW_DEPLOYER);
      fs.writeFileSync(file, content);
      console.log('✅ Fixed:', path.basename(file));
      fixedCount++;
    } else if (content.includes(NEW_DEPLOYER)) {
      console.log('✓ Already fixed:', path.basename(file));
      alreadyFixedCount++;
    } else {
      notFoundCount++;
    }
  }

  console.log(`\nSummary:`);
  console.log(`  Fixed: ${fixedCount}`);
  console.log(`  Already fixed: ${alreadyFixedCount}`);
  console.log(`  No deployer found: ${notFoundCount}`);

  if (fixedCount === 0 && alreadyFixedCount === 0) {
    console.error('❌ Could not find SHELBY_DEPLOYER in any SDK file');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error fixing SDK:', error.message);
  process.exit(1);
}
