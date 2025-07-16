#!/usr/bin/env tsx

/**
 * XMTP SDK Version Manager - Creates symlinks for SDK/bindings compatibility
 */

import { execSync } from "child_process";
import * as fs from "node:fs";
import * as path from "node:path";

function createBindingsSymlinks() {
  const xmtpDir = path.join(process.cwd(), "node_modules", "@xmtp");

  if (!fs.existsSync(xmtpDir)) {
    console.error("@xmtp directory not found");
    return;
  }

  console.log("Creating bindings symlinks...");

  const sdkDir = path.join(xmtpDir, "node-sdk");
  const bindingsDir = path.join(xmtpDir, "node-bindings");

  if (!fs.existsSync(sdkDir)) {
    console.error("node-sdk directory not found");
    return;
  }

  if (!fs.existsSync(bindingsDir)) {
    console.error("node-bindings directory not found");
    return;
  }

  const sdkNodeModulesXmtpDir = path.join(sdkDir, "node_modules", "@xmtp");
  const symlinkTarget = path.join(sdkNodeModulesXmtpDir, "node-bindings");

  // Remove existing node_modules in SDK
  if (fs.existsSync(path.join(sdkDir, "node_modules"))) {
    fs.rmSync(path.join(sdkDir, "node_modules"), {
      recursive: true,
      force: true,
    });
    console.log("Removed existing node_modules from node-sdk");
  }

  // Create directories and symlink
  fs.mkdirSync(sdkNodeModulesXmtpDir, { recursive: true });

  try {
    const relativeBindingsPath = path.relative(
      sdkNodeModulesXmtpDir,
      bindingsDir,
    );
    fs.symlinkSync(relativeBindingsPath, symlinkTarget);
    console.log(`✅ Linked node-sdk -> node-bindings`);
  } catch (error) {
    console.error(`Error creating symlink: ${String(error)}`);
  }
}

function cleanPackageJson() {
  const packageJsonPath = path.join(process.cwd(), "package.json");

  if (!fs.existsSync(packageJsonPath)) return;

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

    if (packageJson.imports) {
      delete packageJson.imports;
      fs.writeFileSync(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2) + "\n",
      );
      console.log('Removed "imports" field from package.json');
    }
  } catch (error) {
    console.error(`Error processing package.json: ${String(error)}`);
  }
}

function main() {
  const shouldClean = process.argv.includes("--clean");

  if (shouldClean) {
    cleanPackageJson();
  }

  if (!process.env.GITHUB_ACTIONS) {
    const nodeModulesDir = path.join(process.cwd(), "node_modules");
    if (fs.existsSync(nodeModulesDir)) {
      fs.rmSync(nodeModulesDir, { recursive: true, force: true });
    }
    execSync("yarn install", { stdio: "inherit" });
  }

  createBindingsSymlinks();
  console.log("Done");
}

main(); 