import "dotenv/config";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import { getDbPath, createSigner, getEncryptionKeyFromHex, validateEnvironment, logAgentDetails } from "../helpers/client";

const { WALLET_KEY, ENCRYPTION_KEY } = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY",
]);

const signer = createSigner(WALLET_KEY as `0x${string}`);
const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

const env: XmtpEnv = process.env.XMTP_ENV as XmtpEnv;

const MAX_RETRIES = 5;
// wait 5 seconds before each retry
const RETRY_INTERVAL = 5000;

let retries = MAX_RETRIES;
let client: Client;

const retry = () => {
  console.log(
    `Retrying in ${RETRY_INTERVAL / 1000}s, ${retries} retries left`,
  );
  if (retries > 0) {
    retries--;
    setTimeout(() => {
      handleStream(client);
    }, RETRY_INTERVAL);
  } else {
    console.log("Max retries reached, ending process");
    process.exit(1);
  }
};

const onFail = () => {
  console.log("Stream failed");
  retry();
};

const onMessage = async (message: any) => {
  if (
    message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
    message?.contentType?.typeId !== "text"
  ) {
    return;
  }

  console.log(
    `Received message: ${message.content as string} by ${
      message.senderInboxId
    }`
  );

  const conversation = await client.conversations.getConversationById(
    message.conversationId
  );

  if (!conversation) {
    console.log("Unable to find conversation, skipping");
    return;
  }

  console.log(`Sending "gm" response...`);
  await conversation.send("gm");
  
  // Reset retry count on successful message processing
  retries = MAX_RETRIES;
};

const handleStream = async (client: Client) => {
  console.log("Syncing conversations...");
  await client.conversations.sync();

  const stream = await client.conversations.streamAllMessages(
    onMessage,
    undefined,
    undefined,
    onFail,
  );

  console.log("Waiting for messages...");


};

async function main() {
  console.log(`Creating client on the '${env}' network...`);
  const signerIdentifier = (await signer.getIdentifier()).identifier;
  client = await Client.create(signer, {
    dbEncryptionKey,
    env,
    dbPath: getDbPath(env + "-" + signerIdentifier),  
    loggingLevel: process.env.LOGGING_LEVEL as any,
  });
  logAgentDetails(client);

  await handleStream(client);
}

main().catch(console.error);
