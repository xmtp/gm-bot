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


const sendPool = new Piscina({
  filename: resolve(process.cwd(), 'dist/src/sendWorker.js'),
  maxThreads: 100,
  minThreads: 1,
});


const onMessage = async (err: Error | null, message?: DecodedMessage) => {
  messageCount++;
  sendPool.run({
    message,
    clientInboxId: client.inboxId,
    env: {
      WALLET_KEY,
      ENCRYPTION_KEY,
      XMTP_ENV: env,
    }
  }).catch(() => null);

};



async function main() {
  console.log(`Creating ultra-light client on '${env}' network...`);
  
  
  // Main thread client - ONLY for streaming (absolute minimum)
  client = await Client.create(signer, {
    dbEncryptionKey,
    env,
    dbPath: getDbPath("receive" + "-" + env),  
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