import { Agent,  } from "@xmtp/agent-sdk";
import { logDetails,  getTestUrl } from "@xmtp/agent-sdk/debug";


// Load .env file only in local development
if (process.env.NODE_ENV !== 'production') process.loadEnvFile(".env");


const agent = await Agent.createFromEnv({
  dbPath: (inboxId) =>(process.env.RAILWAY_VOLUME_MOUNT_PATH ?? "." )+ `/${process.env.XMTP_ENV}-${inboxId.slice(0, 8)}.db3`,
});


agent.on("text", async (ctx) => {
  if (ctx.isDm()) {
    const messageContent = ctx.message.content;
    const senderAddress = await ctx.getSenderAddress();
    console.log(`Received message: ${messageContent} by ${senderAddress}`);
    await ctx.sendText("gm");
  }
});

agent.on("text", async (ctx) => {
  if (ctx.isGroup() && ctx.message.content.includes("@gm")) {
    const senderAddress = await ctx.getSenderAddress();
    console.log(
      `Received message in group: ${ctx.message.content} by ${senderAddress}`,
    );
    await ctx.sendText("gm");
  }
});

agent.on("group", async (ctx) => {
  console.log(`Received message in group: ${ctx.conversation.id}`);
});

agent.on("dm", async (ctx) => {
  console.log(`Received message in group: ${ctx.conversation.id}`);
});

// 4. Log when we're ready
agent.on("start", (): void => {
  logDetails(agent.client)
});

await agent.start();


