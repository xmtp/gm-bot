import { Agent, MessageContext } from "@xmtp/agent-sdk";
import { getTestUrl, logDetails } from "@xmtp/agent-sdk/debug";

// Load .env file only in local development
if (process.env.NODE_ENV !== "production") process.loadEnvFile(".env");

const agent = await Agent.createFromEnv({
  disableDeviceSync: true,
  dbPath: (inboxId) =>
    (process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".") +
    `/${process.env.XMTP_ENV}-${inboxId.slice(0, 8)}.db3`,
});

 async function getMessageBody(ctx: MessageContext) {
  try {
    const messageContent = ctx.message.content as string;
    const senderAddress = (await ctx.getSenderAddress()) as string;

    const messageBody1 = `replying content: ${messageContent} sent by ${senderAddress} on ${ctx.message.sentAt.toISOString()} on converstion ${ctx.conversation.id}`;

    console.log(messageBody1);
    return messageBody1;
  } catch (error) {
    console.error("Error getting message body", error);
    return "Error getting message body";
  }
}

agent.on("text", async (ctx) => {
  const messageBody1 = await getMessageBody(ctx);
  if (ctx.isDm()) {
    await ctx.sendText(messageBody1);
  } else if (ctx.isGroup() && ctx.message.content.includes("@echo")) {
    await ctx.sendText(messageBody1);
  }
});

agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.address}`);
  console.log(`🔗${getTestUrl(agent.client)}`);
  logDetails(agent.client).catch(console.error);
});

await agent.start({
  disableSync: true,
});
