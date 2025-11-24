import { Agent } from "@xmtp/agent-sdk";
import { getTestUrl, logDetails } from "@xmtp/agent-sdk/debug";

// Load .env file only in local development
if (process.env.NODE_ENV !== "production") process.loadEnvFile(".env");

const agent = await Agent.createFromEnv({
  disableDeviceSync: true,
  dbPath: (inboxId) =>
    (process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".") +
    `/${process.env.XMTP_ENV}-${inboxId.slice(0, 8)}.db3`,
});


console.log("Listening for messages...");
agent.on("text", async (ctx) => {
 
  if (ctx.isDm()) {
    const messageContent = ctx.message.content;
    const senderAddress = await ctx.getSenderAddress();
    console.log(`Received message: ${messageContent} by ${senderAddress}`);
    await ctx.sendText("gm");
  } else if (ctx.isGroup() && ctx.message.content.includes("@gm"))
    await ctx.sendText("gm");
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
