import "dotenv/config";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import { createSigner, getEncryptionKeyFromHex, validateEnvironment } from "../helpers/client";

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
  const stream = await client.conversations.streamAllMessages();

  for await (const message of stream) {
    if (
      message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
      message?.contentType?.typeId !== "text"
    ) {
      continue;
    }

  }
}

main().catch(console.error);