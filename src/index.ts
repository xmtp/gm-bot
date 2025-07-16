import "dotenv/config";
import { Client, DecodedMessage, LogLevel, type XmtpEnv } from "@xmtp/node-sdk";
import { createSigner, getDbPath, getEncryptionKeyFromHex } from "../helpers/client";

const { WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV } = process.env;

if (!WALLET_KEY || !ENCRYPTION_KEY) {
  throw new Error("WALLET_KEY and ENCRYPTION_KEY must be set");
}

const signer = createSigner(WALLET_KEY as `0x${string}`);
const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);
const env: XmtpEnv = (XMTP_ENV as XmtpEnv) || "dev";

async function main() {
  console.log(`Creating client on the '${env}' network...`);
  
  const client = await Client.create(signer, {
    dbEncryptionKey,
    env,
    loggingLevel: "debug" as LogLevel,
    dbPath: getDbPath("gm-bot-"+env),
  });

  console.log("Syncing conversations...");
  await client.conversations.sync();

  const identifier = await signer.getIdentifier();
  console.log(`Agent initialized on ${identifier.identifier}`);

  console.log("Waiting for messages...");
  const onMessage = async (err: Error | null | undefined, message?: DecodedMessage) => {
    if (err) {
      console.error("Message stream error:", err);
      return;
    }

    if (!message) {
      return;
    }

    if(message.contentType?.typeId !== "text") {
      return;
    }

    if(message.senderInboxId.toLowerCase() === client.inboxId.toLowerCase()) {
      return;
    }

    console.log(`Received: ${message.content} from ${message.senderInboxId}`);
    const conversation = await client.conversations.getConversationById(message.conversationId)
      if(!conversation) {
        console.log(`Conversation not found: ${message.conversationId}`);
        return;
      }
      await conversation.send("gm: " + message.content);
      console.log(`Replied to: ${message.content}`);
    
  }
  client.conversations.streamAllMessages(onMessage);
}

main().catch(console.error);