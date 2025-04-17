import "dotenv/config";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import { createSigner, getEncryptionKeyFromHex } from "./helper";

const { WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV } = process.env;

if (!WALLET_KEY) {
  throw new Error("WALLET_KEY must be set");
}

if (!ENCRYPTION_KEY) {
  throw new Error("ENCRYPTION_KEY must be set");
}

const signer = createSigner(WALLET_KEY as `0x${string}`);
const encryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

const env: XmtpEnv = (XMTP_ENV as XmtpEnv) || "dev";

async function main() {
  console.log(`Creating client on the '${env}' network...`);

  // Create XMTP client
  const client = await Client.create(signer, {
    env,
    dbEncryptionKey: encryptionKey,
    loggingLevel: process.env.LOGGING_LEVEL as any,
  });

  console.log("Syncing conversations...");
  await client.conversations.sync();

  const identifier = await signer.getIdentifier();
  const address = identifier.identifier;

  console.log(`Number multiplier agent initialized on ${address}`);
  console.log("Waiting for messages...");

  const stream = client.conversations.streamAllMessages();

  for await (const message of await stream) {
    // Skip messages from self or non-text messages
    if (
      message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
      message?.contentType?.typeId !== "text"
    ) {
      continue;
    }

    const messageText = message.content as string;
    console.log(
      `Received message: ${messageText} from ${message.senderInboxId}`
    );

    // Try to parse the message as a number
    const parsedNumber = parseFloat(messageText);

    // Get the conversation to reply to
    const conversation = await client.conversations.getConversationById(
      message.conversationId
    );

    if (!conversation) {
      console.log("Unable to find conversation, skipping");
      continue;
    }

    if (isNaN(parsedNumber)) {
      // Not a valid number
      console.log("Message is not a valid number, sending error response");
      await conversation.send(
        "Please send a valid number and I'll multiply it by 2."
      );
    } else {
      // It's a valid number, multiply by 2 and respond
      const result = parsedNumber * 2;
      console.log(`Calculated ${parsedNumber} × 2 = ${result}`);
      await conversation.send(`${parsedNumber} × 2 = ${result}`);
    }

    console.log("Waiting for messages...");
  }
}

main().catch(console.error);
