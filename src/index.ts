import "dotenv/config";
import { Client,  LogLevel, type XmtpEnv } from "@xmtp/node-sdk";
import { createSigner, getDbPath, getEncryptionKeyFromHex, logAgentDetails, validateEnvironment } from "../helpers/client";

const { WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV ,LOGGING_LEVEL } = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY",
  "XMTP_ENV",
  "LOGGING_LEVEL",
]);

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
  });
  let messageCount = 1;
  void logAgentDetails(client);
  console.log("Syncing conversations...");
  console.time("syncAll");
  await client.conversations.syncAll();
  console.timeEnd("syncAll");
  console.time("streamAllMessages");
  const stream = await client.conversations.streamAllMessages();
  console.timeEnd("streamAllMessages");
  console.log("Waiting for messages...");
  for await (const message of stream) {
    // Skip if the message is from the bot
    if(message.senderInboxId.toLowerCase() === client.inboxId.toLowerCase()) {
      continue;
    }
    // Skip if the message is not a text message
    if (message.contentType?.typeId !== "text") {
      continue;
    }

    console.log(`Received: ${message.content} from ${message.senderInboxId}`);
    const conversation = await client.conversations.getConversationById(message.conversationId)
    if(!conversation) {
      console.log(`Conversation not found: ${message.conversationId}`);
      continue;
    }
    await conversation.send("gm: " + message.content);
    console.log(`${messageCount++} : ${message.content}`);
  }
}

main().catch(console.error);