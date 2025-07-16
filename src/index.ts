import "dotenv/config";
import { Client,  LogLevel, type XmtpEnv } from "@xmtp/node-sdk";
import { createSigner, getDbPath, getEncryptionKeyFromHex, logAgentDetails, validateEnvironment } from "../helpers/client";

const { WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV, LOGGING_LEVEL } = validateEnvironment(["WALLET_KEY", "ENCRYPTION_KEY", "XMTP_ENV", "LOGGING_LEVEL"]);


const signer = createSigner(WALLET_KEY as `0x${string}`);
const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);
const env: XmtpEnv = (XMTP_ENV as XmtpEnv) || "dev";

async function main() {
  console.log(`Creating client on the '${env}' network...`);
  
  const client = await Client.create(signer, {
    dbEncryptionKey,
    env,
    loggingLevel: LOGGING_LEVEL as LogLevel,
    dbPath: getDbPath("gm-bot-"+env),
    disableDeviceSync: true,
  });

  console.log("Syncing conversations...");
  await client.conversations.sync();
  logAgentDetails(client);
  const identifier = await signer.getIdentifier();
  console.log(`Agent initialized on ${identifier.identifier}`);
  let messageCount = 0;
  console.log("Waiting for conversations...");
  
  const stream = await client.conversations.streamAllMessages();
  for await (const message of stream) {
    const minuteAndSecond=new Date().toLocaleTimeString('en-US', {  hour: '2-digit', minute: '2-digit', second: '2-digit' });
    console.log(minuteAndSecond, ":",messageCount++, ":",message?.content);
  }
}

main().catch(console.error);