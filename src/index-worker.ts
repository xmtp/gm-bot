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


const sendPool = new Piscina({
  filename: resolve(process.cwd(), 'dist/src/worker.js'),
  maxThreads: 4,
  minThreads: 2,
});


const onMessage = async (err: Error | null, message?: DecodedMessage) => {
  if (err) {
    console.error("Message stream error:", err);
    return;
  }

  if (!message) {
    return;
  }

  const isSelfMessage = message.senderInboxId.toLowerCase() === client.inboxId.toLowerCase();
  
  if (isSelfMessage) {
    console.log(`Skipping self message 2 from ${message.senderInboxId}`);
    return;
  }
  const isTextMessage = message.contentType?.typeId === "text";
  if (!isTextMessage) {
    console.log(`Skipping non-text message: ${message.contentType?.typeId}`);
    return;
  }

  sendPool.run({
    conversationId: message.conversationId,
    message: `GM! Thanks for your message: "${message.content as string}"`,
    env: {
      WALLET_KEY,
      ENCRYPTION_KEY,
      XMTP_ENV
    } 
  })
};



async function main() {
  const signer = createSigner(WALLET_KEY as `0x${string}`);
  const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);
  const env: XmtpEnv = XMTP_ENV as XmtpEnv;
  const signerIdentifier = (await signer.getIdentifier()).identifier;
  console.log(`Creating ultra-light client on '${env}' network... ${signerIdentifier}`);
  const dbPath = getDbPath("receive" + "-" + env + "-" + signerIdentifier);
  console.log(`DB Path: ${dbPath}`);
  
  // Main thread client - ONLY for streaming (absolute minimum)
  client = await Client.create(signer, {
    dbEncryptionKey,
    env,
    dbPath,  
    loggingLevel: process.env.LOGGING_LEVEL as any,
  });

  console.log("Syncing conversations...");
  await client.conversations.sync();

  client.conversations.streamAllMessages(
    onMessage,
    undefined,
    undefined,
  );

  console.log("Waiting for messages...");
}


main().catch(console.error);