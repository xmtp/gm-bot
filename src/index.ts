import "dotenv/config";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import { createSigner, getEncryptionKeyFromHex, logAgentDetails, validateEnvironment } from "../helpers/client";
  
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
    env,
  });
  await client.conversations.sync();
  console.log("Synced")
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
    const conversation = await client.conversations.getConversationById(
      message.conversationId
    );
  
    if (!conversation) {
      console.log("Unable to find conversation, skipping");
      return;
    }
     await conversation.send("gm: "+message.content)
  }
}

main().catch(console.error);