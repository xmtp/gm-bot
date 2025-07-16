#!/usr/bin/env tsx

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const PACKAGES = [
  { name: "@xmtp/node-sdk", path: "../xmtp-node-js-sdk" },
  { name: "@xmtp/node-bindings", path: "../libxmtp/bindings_node" }
];

function run(command: string, cwd?: string): void {
  console.log(`Running: ${command}`);
  execSync(command, { stdio: 'inherit', cwd: cwd || process.cwd() });
}

for (const pkg of PACKAGES) {
  const fullPath = path.resolve(pkg.path);
  if (existsSync(path.join(fullPath, 'package.json'))) {
    console.log(`\nLinking ${pkg.name}...`);
    run('yarn link', fullPath);
    run(`yarn link "${pkg.name}"`);
    console.log(`✅ ${pkg.name} linked`);
  } else {
    console.log(`⚠️  ${pkg.name} not found at ${pkg.path}`);
  }
}

console.log('\n🎉 Done!'); 