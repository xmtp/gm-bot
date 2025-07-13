import "dotenv/config";
import { Client, DecodedMessage, type XmtpEnv } from "@xmtp/node-sdk";
import { getDbPath, createSigner, getEncryptionKeyFromHex, validateEnvironment, logAgentDetails } from "../helpers/client";

const { WALLET_KEY, ENCRYPTION_KEY } = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY",
]);

const signer = createSigner(WALLET_KEY as `0x${string}`);
const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

const env: XmtpEnv = process.env.XMTP_ENV as XmtpEnv;

const MAX_RETRIES = 5;
const RETRY_INTERVAL = 5000;
// Concurrency control for high-volume processing
const MAX_CONCURRENT_MESSAGES = parseInt(process.env.MAX_CONCURRENT_MESSAGES || "100");
const MESSAGE_QUEUE_SIZE = parseInt(process.env.MESSAGE_QUEUE_SIZE || "600");

let retries = MAX_RETRIES;
let client: Client;
let messageCount = 0;
let currentStream: any = null;
let processingQueue: Array<() => Promise<void>> = [];
let activeProcessors = 0;
let startTime = Date.now();

// Performance monitoring
const logPerformance = () => {
  const elapsed = Date.now() - startTime;
  const messagesPerSecond = messageCount / (elapsed / 1000);
  console.log(`Performance: ${messageCount} messages in ${elapsed}ms (${messagesPerSecond.toFixed(2)} msg/s)`);
};

// Periodic performance logging
setInterval(logPerformance, 10000); // Log every 10 seconds

// Concurrency control
const processQueue = async () => {
  while (processingQueue.length > 0 && activeProcessors < MAX_CONCURRENT_MESSAGES) {
    const processor = processingQueue.shift();
    if (processor) {
      activeProcessors++;
      processor().finally(() => {
        activeProcessors--;
        // Continue processing queue
        setImmediate(processQueue);
      });
    }
  }
};

const queueMessage = (processor: () => Promise<void>) => {
  if (processingQueue.length >= MESSAGE_QUEUE_SIZE) {
    console.log(`Queue full (${MESSAGE_QUEUE_SIZE}), dropping message`);
    return;
  }
  
  processingQueue.push(processor);
  processQueue();
};

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

const onMessage = (err: Error | null, message?: DecodedMessage) => {
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

  messageCount++;
  console.log(
    `[${messageCount}] Received message: ${message.content as string} by ${
      message.senderInboxId
    } (Queue: ${processingQueue.length}, Active: ${activeProcessors})`
  );

  // Queue the message processing instead of processing immediately
  queueMessage(async () => {
    try {
      const conversation = await client.conversations.getConversationById(
        message.conversationId
      );

      if (!conversation) {
        console.log("Unable to find conversation, skipping");
        return;
      }

      conversation.send("gm-" + messageCount);
      console.log(`Replied to message: ${message.content as string}`);
    } catch (error) {
      console.error("Error processing message:", error);
    }
  });
  
  retries = MAX_RETRIES;
};

const handleStream = (client: Client) => {
  // Clean up existing stream if it exists
  if (currentStream) {
    console.log("Cleaning up existing stream");
    try {
      currentStream.return();
    } catch (e) {
      console.log("Error cleaning up stream:", e);
    }
    currentStream = null;
  }

  currentStream = client.conversations.streamAllMessages(
    onMessage,
    undefined,
    undefined,
    onFail,
  );

  console.log(`Waiting for messages... (Max concurrent: ${MAX_CONCURRENT_MESSAGES}, Queue size: ${MESSAGE_QUEUE_SIZE})`);
};

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  if (currentStream) {
    try {
      currentStream.return();
    } catch (e) {
      console.log("Error during shutdown:", e);
    }
  }
  logPerformance();
  process.exit(0);
});

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

  console.log("Syncing conversations...");
  await client.conversations.sync();
  await handleStream(client);
}

main().catch(console.error);