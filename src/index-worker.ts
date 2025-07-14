import "dotenv/config";
import { Client, DecodedMessage, type XmtpEnv } from "@xmtp/node-sdk";
import { getDbPath, createSigner, getEncryptionKeyFromHex, validateEnvironment, logAgentDetails } from "../helpers/client.js";
import Piscina from "piscina";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// Initialize Piscina worker pool
const pool = new Piscina({
  filename: resolve(process.cwd(), 'dist/src/messageWorker.js'),
  maxThreads: 4, // Adjust based on your needs
  minThreads: 1,
});

const retry = () => {
  console.log(
    `Retrying in ${RETRY_INTERVAL / 1000}s, ${retries} retries left`,
  );
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
    console.log("No message received");
    return;
  }

  messageCount++;
  console.log(`[Total: ${messageCount}] Received message from ${message.senderInboxId}`);

  // Delegate message processing to worker pool (non-blocking!)
  pool.run({
    message,
    clientInboxId: client.inboxId,
    env: {
      WALLET_KEY,
      ENCRYPTION_KEY,
      XMTP_ENV: env,
    }
  }).then((result) => {
    if (result.success) {
      if (!result.skipped) {
        console.log(`[Processed: ${messageCount}] Successfully processed message ${result.messageId}`);
      }
    } else {
      console.log(`[Error: ${messageCount}] Failed to process message: ${result.error}`);
    }
  }).catch((error) => {
    console.error('Worker pool error:', error);
  });

  // Reset retry count on successful message reception
  retries = MAX_RETRIES;
};

const handleStream = async (client: Client) => {
  // Clean up existing stream if it exists
  if (currentStream) {
    console.log("Cleaning up existing stream");
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
  console.log(`Creating client on the '${env}' network...`);
  const signerIdentifier = (await signer.getIdentifier()).identifier;
  client = await Client.create(signer, {
    dbEncryptionKey,
    env,
    dbPath: getDbPath(env + "-" + signerIdentifier),  
    loggingLevel: process.env.LOGGING_LEVEL as any,
  });
  logAgentDetails(client);

  await handleStream(client);
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await pool.destroy();
  process.exit(0);
});

main().catch(console.error);