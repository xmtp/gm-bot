import "dotenv/config";
import { Client, DecodedMessage, type XmtpEnv } from "@xmtp/node-sdk";
import { createSigner, getEncryptionKeyFromHex, getDbPath } from "../helpers/client.js";

let client: Client | null = null;

interface MessageTask {
  message: DecodedMessage;
  clientInboxId: string;
  env: {
    WALLET_KEY: string;
    ENCRYPTION_KEY: string;
    XMTP_ENV: string;
  };
}

async function initializeClient(env: MessageTask['env']) {
  if (client) return client;
  
  const signer = createSigner(env.WALLET_KEY as `0x${string}`);
  const dbEncryptionKey = getEncryptionKeyFromHex(env.ENCRYPTION_KEY);
  const xmtpEnv: XmtpEnv = env.XMTP_ENV as XmtpEnv;
  
  const signerIdentifier = (await signer.getIdentifier()).identifier;
  
  client = await Client.create(signer, {
    dbEncryptionKey,
    env: xmtpEnv,
    dbPath: getDbPath(xmtpEnv + "-" + signerIdentifier),
    loggingLevel: process.env.LOGGING_LEVEL as any,
  });
  
  console.log(`Worker: Client initialized for ${signerIdentifier}`);
  return client;
}

// This is the main function that Piscina will call
export default async function processMessage({ message, clientInboxId, env }: MessageTask) {
  try {
    const workerClient = await initializeClient(env);

    // Skip messages from self or non-text messages  
    if (
      message?.senderInboxId.toLowerCase() === clientInboxId.toLowerCase() ||
      message?.contentType?.typeId !== "text"
    ) {
      return { success: true, skipped: true, messageId: message.id };
    }

    console.log(`Worker: Processing message: ${message.content as string} by ${message.senderInboxId}`);

    // Sync conversations to ensure we have the latest data
    await workerClient.conversations.sync();
    
    const conversation = await workerClient.conversations.getConversationById(
      message.conversationId
    );

    if (!conversation) {
      console.log("Worker: Unable to find conversation, skipping");
      return { success: false, error: 'Conversation not found', messageId: message.id };
    }

    await conversation.send("gm: " + message.content);
    console.log(`Worker: Replied to message: ${message.content as string}`);
    
    return { success: true, messageId: message.id };
  } catch (error) {
    console.error('Worker: Error processing message:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      messageId: message.id 
    };
  }
} 