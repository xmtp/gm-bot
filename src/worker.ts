
import { Client, type XmtpEnv,  } from "@xmtp/node-sdk";
import { createSigner, getDbPath, getEncryptionKeyFromHex, validateEnvironment } from "../helpers/client.js";

let client: Client | null = null;



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
  const dbEncryptionKey = getEncryptionKeyFromHex(env.ENCRYPTION_KEY);
  
  // // Get the wallet address from the signer
  // const identifier = await signer.getIdentifier();
  
  client = await Client.create(signer, {
    dbEncryptionKey,
      env: env.XMTP_ENV as XmtpEnv,
    dbPath: getDbPath("receive" + "-" + env.XMTP_ENV),
    loggingLevel: process.env.LOGGING_LEVEL as any,
  });
  
  return client;
}

export default async function sendMessage({ message, conversationId, workerId, env }: SendTask) {
  try {
    const sendClient = await initializeClient(env);
    const conversation = await sendClient.conversations.getConversationById(conversationId);
    
    if (conversation) 
      await conversation.send(message);
   
    
  } catch (error) {
    console.error(`Send Worker ${workerId}: Error sending message:`, error);
  }
} 