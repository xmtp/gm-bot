import "dotenv/config";
import { Agent, MessageContext } from "@xmtp/agent-sdk";
import { getTestUrl, logDetails } from "@xmtp/agent-sdk/debug";

// Immediate synchronous log - FIRST THING that runs (after imports)
console.log(
  `[RESTART] GM bot starting - PID: ${process.pid} at ${new Date().toISOString()}`,
);

const agent = await Agent.createFromEnv({
  disableDeviceSync: true,
  dbPath: (inboxId) =>
    (process.env.RAILWAY_VOLUME_MOUNT_PATH ?? "./data/") +
    `${process.env.XMTP_ENV}-${inboxId.slice(0, 8)}.db3`,
});

 async function getMessageBody(ctx: MessageContext) {
  try {
    const messageContent = ctx.message.content as string;
    const senderAddress = (await ctx.getSenderAddress()) as string;
    const dateString = ctx.message.sentAt.toISOString();

    const messageBody = `replying from MAC to a message sent by ${senderAddress} on ${dateString} on converstion ${ctx.conversation.id}. Content: "${messageContent}"`;

    console.log(messageBody);
    return messageBody;
  } catch (error) {
    console.error("Error getting message body", error);
    return "Error getting message body";
  }
}

agent.on("text", async (ctx) => {
  const messageBody1 = await getMessageBody(ctx);
  console.log("messageBody1", messageBody1);
  if (ctx.isDm()) {
    await ctx.conversation.sendText(messageBody1);
  } else if (ctx.isGroup() && ctx.message.content.includes("@echo")) {
    await ctx.conversation.sendText(messageBody1);
  }
});

// Handle agent-level unhandled errors
agent.on("unhandledError", (error) => {
  console.error("GM bot fatal error:", error);
  if (error instanceof Error) {
    console.error("Error stack:", error.stack);
  }
  console.error("Exiting process - PM2 will restart");
  process.exit(1);
});

agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.address}`);
  console.log(`🔗${getTestUrl(agent.client)}`);
  logDetails(agent).catch(console.error);
});

await agent.start()
