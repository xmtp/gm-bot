import "dotenv/config";
import { Client, DecodedMessage, type XmtpEnv } from "@xmtp/node-sdk";
import { getDbPath, createSigner, getEncryptionKeyFromHex, validateEnvironment } from "../helpers/client.js";
import Piscina from "piscina";
import { resolve } from "path";

const { WALLET_KEY, ENCRYPTION_KEY,XMTP_ENV } = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY",
  "XMTP_ENV"
]);


let client: Client;
let messageCount = 0;


const sendPool = new Piscina({
  filename: resolve(process.cwd(), 'dist/src/sendWorker.js'),
  maxThreads: 5,
  minThreads: 1,
});


const onMessage = async (err: Error | null, message?: DecodedMessage) => {
  if (
    message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
    message?.contentType?.typeId !== "text"
  ) {
    return;
  }

  messageCount++;
  
  // Skip messages from self or non-text messages
  console.log(
    `Received message: ${message.content as string} by ${message.senderInboxId}`
  );

  sendPool.run({
    conversationId: message.conversationId,
    message: message.content as string,
    workerId: messageCount,
    env: {
      WALLET_KEY,
      ENCRYPTION_KEY,
      XMTP_ENV
    } 
  }).catch((error) => {
    console.error("Worker error:", error);
  });
};



async function main() {
  const signer = createSigner(WALLET_KEY as `0x${string}`);
  const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);
  const env: XmtpEnv = XMTP_ENV as XmtpEnv;
  const signerIdentifier = (await signer.getIdentifier()).identifier;
  console.log(`Creating ultra-light client on '${env}' network... ${signerIdentifier}`);
  const dbPath = getDbPath("receive" + "-" + env);
  console.log(`DB Path: ${dbPath}`);
  
  // Main thread client - ONLY for streaming (absolute minimum)
  client = await Client.create(signer, {
    dbEncryptionKey,
    env,
    dbPath,  
    loggingLevel: process.env.LOGGING_LEVEL as any,
  });

  console.log("Syncing conversations...");
  await client.conversations.syncAll();

  client.conversations.streamAllMessages(
    onMessage,
    undefined,
    undefined,
  );

  console.log("Waiting for messages...");
}


main().catch(console.error);