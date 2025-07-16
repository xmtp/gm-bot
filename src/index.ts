import "dotenv/config";
import { Client, type LogLevel, type XmtpEnv } from "@xmtp/node-sdk";
import { createSigner, getDbPath, getEncryptionKeyFromHex, logAgentDetails, validateEnvironment } from "../helpers/client";
  
const { WALLET_KEY, ENCRYPTION_KEY } = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY",
]);

const signer = createSigner(WALLET_KEY as `0x${string}`);
const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);
const env: XmtpEnv = process.env.XMTP_ENV as XmtpEnv;

async function main() {
  const client = await Client.create(signer, {
    dbEncryptionKey,
    loggingLevel: "debug" as LogLevel,  
    dbPath: getDbPath("gm-bot-"+env),
    env,
  });
  await client.conversations.sync();
  logAgentDetails(client)
  const stream = await client.conversations.streamAllMessages();
  let messageCount = 1;
  for await (const message of stream) {
    if (
      message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
      message?.contentType?.typeId !== "text"
    ) {
      continue;
    }
    console.log(messageCount, message.content as string)
    messageCount++;

  }
}

main().catch(console.error);