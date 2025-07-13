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
// wait 5 seconds before each retry
const RETRY_INTERVAL = 5000;

let retries = MAX_RETRIES;
let client: Client;
let messageCount = 0;
let totalMessageCount = 0; // Track all messages received from stream
let currentStream: any = null; // Store reference to current stream

// Response time tracking
let totalResponseTime = 0; // Total response time in milliseconds
let totalSentTime = 0; // Total sent time in milliseconds
let processedMessageCount = 0; // Count of messages we actually processed and replied to

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

  totalMessageCount++;
  console.log(`[Total: ${totalMessageCount}] Received raw message from ${message.senderInboxId}`);

  if (
    message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
    message?.contentType?.typeId !== "text"
  ) {
    console.log(`[Total: ${totalMessageCount}] Filtered out message (self or non-text)`);
    return;
  }

  messageCount++;
  const messageStartTime = Date.now(); // Record start time for response measurement
  
  console.log(
    `[Processed: ${messageCount}/${totalMessageCount}] Processing message: ${message.content as string} by ${
      message.senderInboxId
    }`
  );

  const conversation = await client.conversations.getConversationById(
    message.conversationId
  );

  if (!conversation) {
    console.log("Unable to find conversation, skipping");
    return;
  }

  const sendStartTime = Date.now(); // Record start time for send measurement
  
  conversation.send("gm").then(() => {
    const sendEndTime = Date.now();
    const messageEndTime = Date.now();
    
    const responseTime = messageEndTime - messageStartTime;
    const sentTime = sendEndTime - sendStartTime;
    
    // Update totals
    totalResponseTime += responseTime;
    totalSentTime += sentTime;
    processedMessageCount++;
    
    // Calculate averages
    const avgResponseTime = totalResponseTime / processedMessageCount;
    const avgSentTime = totalSentTime / processedMessageCount;
    
    console.log(`Replied to message: ${message.content as string}`);
    console.log(`Response time: ${(responseTime / 1000).toFixed(3)}s, Sent time: ${(sentTime / 1000).toFixed(3)}s`);
    console.log(`Avg response time: ${(avgResponseTime / 1000).toFixed(3)}s, Avg sent time: ${(avgSentTime / 1000).toFixed(3)}s`);
  }).catch(console.error);
  
  // Reset retry count on successful message processing
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

main().catch(console.error);