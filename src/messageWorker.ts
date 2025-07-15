import "dotenv/config";
import { Client, DecodedMessage, type XmtpEnv } from "@xmtp/node-sdk";
import { createSigner, getEncryptionKeyFromHex } from "../helpers/client.js";

let client: Client | null = null;

interface MessageTask {
  message: DecodedMessage;
  clientInboxId: string;
  workerId: number;
  sharedDbPath: string;
  env: {
    WALLET_KEY: string;
    ENCRYPTION_KEY: string;
    XMTP_ENV: string;
  };
}

async function initializeClient(env: MessageTask['env'], sharedDbPath: string) {
  if (client) return client;
  
  const signer = createSigner(env.WALLET_KEY as `0x${string}`);
  const dbEncryptionKey = getEncryptionKeyFromHex(env.ENCRYPTION_KEY);
  
  client = await Client.create(signer, {
    dbEncryptionKey,
    env: env.XMTP_ENV as XmtpEnv,
    dbPath: sharedDbPath,
    loggingLevel: process.env.LOGGING_LEVEL as any,
  });
  
  return client;
}

export default async function processMessage({ message, clientInboxId, workerId, sharedDbPath, env }: MessageTask) {
  try {
    const workerClient = await initializeClient(env, sharedDbPath);

    if (message?.senderInboxId.toLowerCase() === clientInboxId.toLowerCase() || message?.contentType?.typeId !== "text") {
      return { success: true, skipped: true, messageId: message.id };
    }

    await workerClient.conversations.sync();
    const conversation = await workerClient.conversations.getConversationById(message.conversationId);

    if (!conversation) {
      return { success: false, error: 'Conversation not found', messageId: message.id };
    }

    await conversation.send("gm: " + message.content);
    return { success: true, messageId: message.id, workerId };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      messageId: message.id,
      workerId 
    };
  }
} 