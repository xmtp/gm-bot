import "dotenv/config";
import { Client, DecodedMessage, LogLevel, type XmtpEnv } from "@xmtp/node-sdk";
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
  await client.conversations.sync();

  console.log("Waiting for messages...");
  const onValue = async (message: DecodedMessage) => {
    
    

    // Skip if the message is from the bot
    if(message.senderInboxId.toLowerCase() === client.inboxId.toLowerCase()) {
      return;
    }
    // Skip if the message is not a text message
    if (message.contentType?.typeId !== "text") {
      return;
    }

    console.log(`Received: ${message.content} from ${message.senderInboxId}`);
    const conversation = await client.conversations.getConversationById(message.conversationId)
      if(!conversation) {
        console.log(`Conversation not found: ${message.conversationId}`);
        return;
      }
      await conversation.send("gm: " + message.content);
      console.log(`${messageCount++} : ${message.content}`);
     
     
  }
  client.conversations.streamAllMessages({onValue});
}

main().catch(console.error);