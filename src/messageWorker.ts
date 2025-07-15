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

    if (message?.senderInboxId.toLowerCase() === clientInboxId.toLowerCase()) return null;

    await workerClient.conversations.sync();
    const conversation = await workerClient.conversations.getConversationById(message.conversationId);

    if (conversation) {
      // Return send task data for main thread to handle
      return {
        shouldSend: true,
        conversationId: message.conversationId,
        message: "gm: " + message.content
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Worker ${workerId}: Error processing message:`, error);
    return null;
  }
} 