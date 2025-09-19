
import { Agent, getTestUrl, logDetails  } from "@xmtp/agent-sdk";

// Load .env file only in local development
if (process.env.NODE_ENV !== 'production') process.loadEnvFile(".env");


  // 2. Spin up the agent
const agent = await Agent.createFromEnv({
  dbPath: (inboxId) =>
    process.env.RAILWAY_VOLUME_MOUNT_PATH ??
    "." + `/${process.env.XMTP_ENV}-${inboxId.slice(0, 8)}.db3`,
});

agent.on("text",  async (ctx: any) => {
  await ctx.sendText("gm: " + ctx.message.content);
});

// 4. Log when we're ready
agent.on("start", (): void => {
  logDetails(agent.client)
});

await agent.start();


