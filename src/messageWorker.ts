import "dotenv/config";
import { Client, DecodedMessage, type XmtpEnv } from "@xmtp/node-sdk";
import { createSigner, getEncryptionKeyFromHex } from "../helpers/client.js";

let client: Client | null = null;
let currentWorkerId: number | null = null;

interface MessageTask {
  message: DecodedMessage;
  clientInboxId: string;
  workerId: number;
  sharedDbPath: string; // Add shared database path
  env: {
    WALLET_KEY: string;
    ENCRYPTION_KEY: string;
    XMTP_ENV: string;
  };
}

async function initializeClient(env: MessageTask['env'], workerId: number, sharedDbPath: string) {
  // If we already have a client for this worker, reuse it
  if (client && currentWorkerId === workerId) return client;
  
  const signer = createSigner(env.WALLET_KEY as `0x${string}`);
  const dbEncryptionKey = getEncryptionKeyFromHex(env.ENCRYPTION_KEY);
  const xmtpEnv: XmtpEnv = env.XMTP_ENV as XmtpEnv;
  
  const signerIdentifier = (await signer.getIdentifier()).identifier;
  
  // Use the shared database path instead of creating unique worker paths
  client = await Client.create(signer, {
    dbEncryptionKey,
    env: xmtpEnv,
    dbPath: sharedDbPath,
    loggingLevel: process.env.LOGGING_LEVEL as any,
  });
  
  currentWorkerId = workerId;
  console.log(`Worker ${workerId}: Client initialized for ${signerIdentifier} with shared db: ${sharedDbPath}`);
  return client;
}

// This is the main function that Piscina will call
export default async function processMessage({ message, clientInboxId, workerId, sharedDbPath, env }: MessageTask) {
  try {
    const workerClient = await initializeClient(env, workerId, sharedDbPath);

    // Skip messages from self or non-text messages  
    if (
      message?.senderInboxId.toLowerCase() === clientInboxId.toLowerCase() ||
      message?.contentType?.typeId !== "text"
    ) {
      return { success: true, skipped: true, messageId: message.id };
    }

    console.log(`Worker ${workerId}: Processing message: ${message.content as string} by ${message.senderInboxId}`);

    // Worker handles ALL XMTP operations - sync conversations to ensure we have the latest data
    await workerClient.conversations.sync();
    
    const conversation = await workerClient.conversations.getConversationById(
      message.conversationId
    );

    if (!conversation) {
      console.log(`Worker ${workerId}: Unable to find conversation, skipping`);
      return { success: false, error: 'Conversation not found', messageId: message.id };
    }

    // Worker handles sending the reply
    await conversation.send("gm: " + message.content);
    console.log(`Worker ${workerId}: Replied to message: ${message.content as string}`);
    
    return { success: true, messageId: message.id, workerId };
  } catch (error) {
    console.error(`Worker ${workerId}: Error processing message:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      messageId: message.id,
      workerId 
    };
  }
} 