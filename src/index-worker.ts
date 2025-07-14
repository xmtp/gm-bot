import "dotenv/config";
import { Client, DecodedMessage, type XmtpEnv } from "@xmtp/node-sdk";
import { getDbPath, createSigner, getEncryptionKeyFromHex, validateEnvironment } from "../helpers/client.js";
import Piscina from "piscina";
import { resolve } from "path";

const { WALLET_KEY, ENCRYPTION_KEY } = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY",
]);

const signer = createSigner(WALLET_KEY as `0x${string}`);
const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);
const env: XmtpEnv = process.env.XMTP_ENV as XmtpEnv;

const MAX_RETRIES = 5;
const RETRY_INTERVAL = 5000;

let retries = MAX_RETRIES;
let client: Client;
let messageCount = 0;
let currentStream: any = null;

// Ultra-light worker pool
const pool = new Piscina({
  filename: resolve(process.cwd(), 'dist/src/messageWorker.js'),
  maxThreads: 4,
  minThreads: 1,
});

const retry = () => {
  console.log(`Retrying in ${RETRY_INTERVAL / 1000}s, ${retries} retries left`);
  if (retries > 0) {
    retries--;
    setTimeout(() => {
      handleStream(client);
    }, RETRY_INTERVAL);
  } else {
    console.log("Max retries reached, ending process");
    process.exit(1);
  }
};

const onFail = () => {
  console.log("Stream failed");
  retry();
};

const onMessage = async (err: Error | null, message?: DecodedMessage) => {
  if (err) {
    console.log("Error", err);
    return;
  }

  if (!message) {
    return;
  }

  messageCount++;
  console.log(`[${messageCount}] Message from ${message.senderInboxId}`);

  // Get the shared database path to pass to workers
  const signerIdentifier = (await signer.getIdentifier()).identifier;
  const sharedDbPath = getDbPath(env + "-shared-" + signerIdentifier);

  // ULTRA-LIGHT: Fire-and-forget - zero waiting, zero logging, zero error handling
  pool.run({
    message,
    clientInboxId: client.inboxId,
    workerId: Math.floor(Math.random() * 1000),
    sharedDbPath, // Pass the shared database path
    env: {
      WALLET_KEY,
      ENCRYPTION_KEY,
      XMTP_ENV: env,
    }
  }).catch(() => {}); // Silent catch - main thread doesn't care about worker results

  retries = MAX_RETRIES;
};

const handleStream = async (client: Client) => {
  if (currentStream) {
    try {
      await currentStream.return();
    } catch (e) {
      console.log("Error cleaning up stream:", e);
    }
    currentStream = null;
  }

  console.log("Syncing conversations...");
  await client.conversations.sync();

  currentStream = await client.conversations.streamAllMessages(
    onMessage,
    undefined,
    undefined,
    onFail,
  );

  console.log("Waiting for messages...");
};

async function main() {
  console.log(`Creating ultra-light client on '${env}' network...`);
  const signerIdentifier = (await signer.getIdentifier()).identifier;
  
  // Shared database path for all threads
  const sharedDbPath = getDbPath(env + "-shared-" + signerIdentifier);
  
  // Main thread client - ONLY for streaming (absolute minimum)
  client = await Client.create(signer, {
    dbEncryptionKey,
    env,
    dbPath: sharedDbPath,  
    loggingLevel: process.env.LOGGING_LEVEL as any,
  });
  
  console.log(`Ultra-light main thread ready for ${signerIdentifier}`);
  await handleStream(client);
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await pool.destroy();
  process.exit(0);
});

main().catch(console.error);