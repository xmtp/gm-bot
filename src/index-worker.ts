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

const signer = createSigner(WALLET_KEY as `0x${string}`);
const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);
const env: XmtpEnv = XMTP_ENV as XmtpEnv;

let client: Client;
let messageCount = 0;
let currentStream: any = null;

// Ultra-light worker pools
const messagePool = new Piscina({
  filename: resolve(process.cwd(), 'dist/src/messageWorker.js'),
  maxThreads: 4,
  minThreads: 1,
});

const sendPool = new Piscina({
  filename: resolve(process.cwd(), 'dist/src/sendWorker.js'),
  maxThreads: 2,
  minThreads: 1,
});


const onMessage = async (err: Error | null, message?: DecodedMessage) => {
  if (err) {
    console.log("Error", err);
    return;
  }

  if (!message) {
    return;
  }

  messageCount++;
  console.log(`[${messageCount}] Message from ${message.senderInboxId}`);

  // Get the shared database path to pass to workers
  const signerIdentifier = (await signer.getIdentifier()).identifier;
  const sharedDbPath = getDbPath(env + "-shared-" + signerIdentifier);

  // Process message in worker thread
  const processResult = await messagePool.run({
    message,
    clientInboxId: client.inboxId,
    workerId: Math.floor(Math.random() * 1000),
    sharedDbPath, // Pass the shared database path
    env: {
      WALLET_KEY,
      ENCRYPTION_KEY,
      XMTP_ENV: env,
    }
  }).catch(() => null);

  // If message processing returned a send task, handle it in send worker
  if (processResult && processResult.shouldSend) {
    sendPool.run({
      conversationId: processResult.conversationId,
      message: processResult.message,
      workerId: Math.floor(Math.random() * 1000),
      sharedDbPath,
      env: {
        WALLET_KEY,
        ENCRYPTION_KEY,
        XMTP_ENV: env,
      }
    }).catch(() => {}); // Silent catch - fire and forget
  }
};



async function main() {
  console.log(`Creating ultra-light client on '${env}' network...`);
  const signerIdentifier = (await signer.getIdentifier()).identifier;
  
  // Shared database path for all threads
  const sharedDbPath = getDbPath(env + "-shared-" + signerIdentifier);
  
  // Main thread client - ONLY for streaming (absolute minimum)
  client = await Client.create(signer, {
    dbEncryptionKey,
    env,
    dbPath: sharedDbPath,  
    loggingLevel: process.env.LOGGING_LEVEL as any,
  });
  
  console.log(`Ultra-light main thread ready for ${signerIdentifier}`);


  console.log("Syncing conversations...");
  await client.conversations.sync();

  currentStream = await client.conversations.streamAllMessages(
    onMessage,
    undefined,
    undefined,
  );

  console.log("Waiting for messages...");
}


main().catch(console.error);