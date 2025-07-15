import "dotenv/config";
import { validateEnvironment } from "../helpers/client.js";
import Piscina from "piscina";
import { resolve } from "path";

const { WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV } = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY",
  "XMTP_ENV"
]);

async function main() {
  console.log("Starting worker-based XMTP stream...");
  
  const streamWorker = new Piscina({
    filename: resolve(process.cwd(), 'dist/src/worker.js'),
    maxThreads: 1,
    minThreads: 1,
  });

  // Send the streaming task to worker
  streamWorker.run({
    type: 'stream',
    env: {
      WALLET_KEY,
      ENCRYPTION_KEY,
      XMTP_ENV
    }
  }).catch((error) => {
    console.error("Stream worker error:", error);
  });

  console.log("Stream worker started...");
}

main().catch(console.error);