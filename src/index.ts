import { ContentTypeText } from "@xmtp/content-type-text";
import dotenv from "dotenv";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import { createSigner, getEncryptionKeyFromHex } from "./helper.js";

dotenv.config();

const { WALLET_KEY, ENCRYPTION_KEY } = process.env;

if (!WALLET_KEY) {
  throw new Error("WALLET_KEY must be set");
}

if (!ENCRYPTION_KEY) {
  throw new Error("ENCRYPTION_KEY must be set");
}

const signer = createSigner(WALLET_KEY as `0x${string}`);
const encryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

const env: XmtpEnv = process.env.XMTP_ENV as XmtpEnv;

async function main() {
  console.log(`Creating client on the '${env}' network...`);
  let volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".data/xmtp";

  const dbPath = `${volumePath}/${signer.getAddress()}-${env}`;

  const client = await Client.create(signer, encryptionKey, { env, dbPath });

  console.log("Syncing conversations...");
  await client.conversations.sync();

  console.log(
    `Agent initialized on ${client.accountAddress}\nSend a message on http://xmtp.chat/dm/${client.accountAddress}?env=${env}`
  );

  console.log("Waiting for messages...");
  const stream = client.conversations.streamAllMessages();

  for await (const message of await stream) {
    if (
      !message ||
      !message.contentType ||
      !ContentTypeText.sameAs(message.contentType)
    ) {
      console.log("Invalid message, skipping", message);
      continue;
    }

    // Ignore own messages
    if (message.senderInboxId === client.inboxId) {
      continue;
    }

    console.log(
      `Received message: ${message.content as string} by ${
        message.senderInboxId
      }`
    );

    const conversation = client.conversations.getConversationById(
      message.conversationId
    );

    if (!conversation) {
      console.log("Unable to find conversation, skipping");
      continue;
    }

    console.log(`Sending "gm" response...`);
    await conversation.send("gm");

    console.log("Waiting for messages...");
  }
}

main().catch(console.error);
