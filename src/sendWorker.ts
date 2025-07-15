import "dotenv/config";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import { createSigner, getEncryptionKeyFromHex } from "../helpers/client.js";

let client: Client | null = null;

interface SendTask {
  conversationId: string;
  message: string;
  workerId: number;
  sharedDbPath: string;
  env: {
    WALLET_KEY: string;
    ENCRYPTION_KEY: string;
    XMTP_ENV: string;
  };
}

async function initializeClient(env: SendTask['env'], sharedDbPath: string) {
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

export default async function sendMessage({ conversationId, message, workerId, sharedDbPath, env }: SendTask) {
  try {
    const sendClient = await initializeClient(env, sharedDbPath);
    
    await sendClient.conversations.sync();
    const conversation = await sendClient.conversations.getConversationById(conversationId);
    
    if (conversation) {
      await conversation.send(message);
      console.log(`Send Worker ${workerId}: Message sent successfully`);
    } else {
      console.log(`Send Worker ${workerId}: Conversation not found`);
    }
  } catch (error) {
    console.error(`Send Worker ${workerId}: Error sending message:`, error);
  }
} 