
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
  const signerIdentifier = (await signer.getIdentifier()).identifier;
  const dbEncryptionKey = getEncryptionKeyFromHex(env.ENCRYPTION_KEY);
  const dbPath = getDbPath("receive" + "-" + env + "-" + signerIdentifier);
  
  client = await Client.create(signer, {
    dbEncryptionKey,
    env: env.XMTP_ENV as XmtpEnv,
    dbPath,
    loggingLevel: process.env.LOGGING_LEVEL as any,
  });
  
  return client;
}

export default async function sendMessage({ message, conversationId, workerId, env }: SendTask) {
  try {
    const sendClient = await initializeClient(env);
    const conversation = await sendClient.conversations.getConversationById(conversationId);
    
    if (conversation)  conversation.send(message).then(() => {
      console.log(`Worker ${workerId}: Sent response to conversation ${conversationId}`);
    }).catch((error) => {
      console.error(`Worker ${workerId}: Error sending message:`, error);
    });
   
    
  } catch (error) {
    console.error(`Send Worker ${workerId}: Error sending message:`, error);
  }
} 