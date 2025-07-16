import { Client, DecodedMessage, type XmtpEnv } from "@xmtp/node-sdk";
import {
  createSigner,
  getDbPath,
  getEncryptionKeyFromHex,
} from "../helpers/client.js";

let client: Client | null = null;
let conversationCache = new Map<string, any>();
let lastSyncTime = 0;

interface SendTask {
  type: "send";
  conversationId: string;
  message: string;
  workerId: number;
  env: {
    WALLET_KEY: string;
    ENCRYPTION_KEY: string;
    XMTP_ENV: string;
  };
}

interface StreamTask {
  type: "stream";
  env: {
    WALLET_KEY: string;
    ENCRYPTION_KEY: string;
    XMTP_ENV: string;
  };
}

type WorkerTask = SendTask | StreamTask;

async function initializeClient(env: WorkerTask["env"]) {
  if (client) return client;

  const signer = createSigner(env.WALLET_KEY as `0x${string}`);
  const signerIdentifier = (await signer.getIdentifier()).identifier;
  const dbEncryptionKey = getEncryptionKeyFromHex(env.ENCRYPTION_KEY);
  const dbPath = getDbPath(`worker-${env.XMTP_ENV}-${signerIdentifier}`);

  client = await Client.create(signer, {
    dbEncryptionKey,
    env: env.XMTP_ENV as XmtpEnv,
    dbPath,
    loggingLevel: process.env.LOGGING_LEVEL as any,
    disableDeviceSync: true,
  });

  await client.conversations.sync();
  lastSyncTime = Date.now();

  return client;
}

async function getConversation(
  client: Client,
  conversationId: string
): Promise<any> {
  if (conversationCache.has(conversationId)) {
    return conversationCache.get(conversationId)!;
  }

  const now = Date.now();
  if (now - lastSyncTime > 30000) {
    await client.conversations.sync();
    lastSyncTime = now;
  }

  const conversation = await client.conversations.getConversationById(
    conversationId
  );
  if (conversation) {
    conversationCache.set(conversationId, conversation);
  }

  return conversation;
}

async function handleStream(env: StreamTask["env"]) {
  console.log("🔄 Worker: Starting message stream...");
  const streamClient = await initializeClient(env);

  const onMessage = async (err: Error | null, message?: DecodedMessage) => {
    if (err) {
      console.error("Message stream error:", err);
      return;
    }

    if (!message) return;

    const isSelfMessage =
      message.senderInboxId.toLowerCase() ===
      streamClient.inboxId.toLowerCase();

    if (isSelfMessage) {
      console.log(`Skipping self message from ${message.senderInboxId}`);
      return;
    }

    const isTextMessage = message.contentType?.typeId === "text";

    if (!isTextMessage) {
      console.log(`Skipping non-text message: ${message.contentType?.typeId}`);
      return;
    }

    console.log(`📨 Worker: Processing message from ${message.senderInboxId}`);

    try {
      const conversation = await getConversation(
        streamClient,
        message.conversationId
      );

      if (conversation) {
        const responseMessage = `GM! Thanks for your message: "${
          message.content as string
        }"`;
        await conversation.send(responseMessage);
        console.log(
          `✅ Worker: Sent response to conversation ${message.conversationId}`
        );
      } else {
        console.log(
          `❌ Worker: Conversation not found ${message.conversationId}`
        );
      }
    } catch (error) {
      console.error(`❌ Worker: Error processing message:`, error);
    }
  };

  streamClient.conversations.streamAllMessages(onMessage);
  console.log("✅ Worker: Waiting for messages...");

  // Keep the worker alive indefinitely
  return new Promise(() => {
    // This promise never resolves, keeping the worker running
  });
}

async function handleSend({
  message,
  conversationId,
  workerId,
  env,
}: SendTask) {
  try {
    console.log(`🔄 Worker ${workerId}: Starting message processing...`);
  } catch (error) {
    console.error(`❌ Worker ${workerId}: Error sending message:`, error);
  }
}

export default async function workerHandler(task: WorkerTask) {
  if (task.type === "stream") {
    await handleStream(task.env);
  } else if (task.type === "send") {
    await handleSend(task);
  }
}
