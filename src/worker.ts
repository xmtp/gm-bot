
import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import { createSigner, getDbPath, getEncryptionKeyFromHex, validateEnvironment } from "../helpers/client.js";

let client: Client | null = null;
let conversationCache = new Map<string, any>();
let lastSyncTime = 0;



interface SendTask {
  conversationId: string;
  message: string;
  workerId: number;
  env: {
    WALLET_KEY: string;
    ENCRYPTION_KEY: string;
    XMTP_ENV: string;
  };
}

async function initializeClient(env: SendTask['env']) {
  if (client) return client;
  
  const signer = createSigner(env.WALLET_KEY as `0x${string}`);
  const signerIdentifier = (await signer.getIdentifier()).identifier;
  const dbEncryptionKey = getEncryptionKeyFromHex(env.ENCRYPTION_KEY);
  const dbPath = getDbPath(`receive-${env.XMTP_ENV}-${signerIdentifier}`);
  
  client = await Client.create(signer, {
    dbEncryptionKey,
    env: env.XMTP_ENV as XmtpEnv,
    dbPath,
    loggingLevel: process.env.LOGGING_LEVEL as any,
  });

  // Initial sync for new client
  await client.conversations.sync();
  lastSyncTime = Date.now();
  
  return client;
}

async function getConversation(client: Client, conversationId: string): Promise<any> {
  // Check cache first
  if (conversationCache.has(conversationId)) {
    return conversationCache.get(conversationId)!;
  }
  
  // Incremental sync if needed (every 30 seconds)
  const now = Date.now();
  if (now - lastSyncTime > 30000) {
    await client.conversations.sync();
    lastSyncTime = now;
  }
  
  const conversation = await client.conversations.getConversationById(conversationId);
  if (conversation) {
    conversationCache.set(conversationId, conversation);
  }
  
  return conversation;
}

export default async function sendMessage({ message, conversationId, workerId, env }: SendTask) {
  try {
    console.log(`🔄 Worker ${workerId}: Starting message processing...`);
    const sendClient = await initializeClient(env);
    
    const conversation = await getConversation(sendClient, conversationId);
    
    if (conversation) {
      await conversation.send(message);
      console.log(`✅ Worker ${workerId}: Sent response to conversation ${conversationId}`);
    } else {
      console.log(`❌ Worker ${workerId}: Conversation not found ${conversationId}`);
    }
  } catch (error) {
    console.error(`❌ Worker ${workerId}: Error sending message:`, error);
  }
} 