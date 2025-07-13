import "dotenv/config";
import { Client, DecodedMessage, type XmtpEnv } from "@xmtp/node-sdk";
import { getDbPath, createSigner, getEncryptionKeyFromHex, validateEnvironment, logAgentDetails } from "../helpers/client";
import PQueue from "p-queue";

const { WALLET_KEY, ENCRYPTION_KEY } = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY",
]);

const env: XmtpEnv = process.env.XMTP_ENV as XmtpEnv;

// Configuration
const MAX_CONCURRENT_MESSAGES = 100; // Process 100 messages simultaneouslysource ~/.bashrc;pr_push
const MAX_RETRIES = 5;
const RETRY_INTERVAL = 5000;

// Metrics
let messageCount = 0;
let processedCount = 0;
let errorCount = 0;
let retries = MAX_RETRIES;

// Message queue for processing
const messageQueue = new PQueue({ 
  concurrency: MAX_CONCURRENT_MESSAGES,
  timeout: 30000, // 30 second timeout per message
  throwOnTimeout: false
});

let client: Client;
let currentStream: any = null;
let isShuttingDown = false;

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

const processMessage = async (message: DecodedMessage) => {
  const messageId = ++messageCount;
  
  console.log(
    `[${messageId}] Queuing message: ${message.content as string} by ${
      message.senderInboxId
    }`
  );

  // Add message to processing queue
  messageQueue.add(async () => {
    try {
      const conversation = await client.conversations.getConversationById(
        message.conversationId
      );

      if (!conversation) {
        throw new Error("Unable to find conversation");
      }

      await conversation.send("gm");
      
      processedCount++;
      console.log(`[${messageId}] ✓ Processed successfully`);
      
      return { success: true, messageId, conversationId: message.conversationId };
    } catch (error) {
      errorCount++;
      console.log(`[${messageId}] ✗ Error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }, { 
    priority: 1, // Higher priority for new messages
    timeout: 30000 // 30 second timeout
  });

  // Reset retry count on successful message queuing
  retries = MAX_RETRIES;
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

  if (
    message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
    message?.contentType?.typeId !== "text"
  ) {
    return;
  }

  // Process message without blocking - fire and forget
  processMessage(message).catch(error => {
    console.log("Error queuing message:", error);
  });
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

// Graceful shutdown
const shutdown = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log("\nShutting down gracefully...");
  console.log(`Final stats: ${messageCount} received, ${processedCount} processed, ${errorCount} errors`);
  
  if (currentStream) {
    try {
      await currentStream.return();
    } catch (e) {
      console.log("Error cleaning up stream:", e);
    }
  }
  
  // Wait for all queued messages to complete
  console.log("Waiting for queued messages to complete...");
  await messageQueue.onIdle();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Log metrics periodically
setInterval(() => {
  const queueSize = messageQueue.size;
  const pendingSize = messageQueue.pending;
  console.log(`📊 Stats: ${messageCount} received, ${processedCount} processed, ${errorCount} errors, ${queueSize} queued, ${pendingSize} pending`);
}, 10000);

async function main() {
  console.log(`Creating client on the '${env}' network...`);
  const signer = createSigner(WALLET_KEY as `0x${string}`);
  const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);
  const signerIdentifier = (await signer.getIdentifier()).identifier;
  
  client = await Client.create(signer, {
    dbEncryptionKey,
    env,
    dbPath: getDbPath(env + "-" + signerIdentifier),  
    loggingLevel: process.env.LOGGING_LEVEL as any,
  });
  
  logAgentDetails(client);
  console.log(`🚀 Parallel processing enabled - max ${MAX_CONCURRENT_MESSAGES} concurrent messages`);

  await handleStream(client);
}

main().catch(console.error); 