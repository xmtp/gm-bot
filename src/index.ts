
import { Agent, getTestUrl, LogLevel,   } from "@xmtp/agent-sdk";

// Load .env file only in local development
if (process.env.NODE_ENV !== 'production') process.loadEnvFile(".env");


  // 2. Spin up the agent
const agent = await Agent.createFromEnv({
  appVersion:'gm-bot/1.0.0',
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
  loggingLevel: "warn" as LogLevel,
  dbPath: process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".data/xmtp/"+process.env.XMTP_ENV+ `-gm-bot.db3`
});

agent.on("text",  async (ctx: any) => {
  console.log(ctx.message);
  await ctx.conversation.send("gm: " + ctx.message.content);
});

// 4. Log when we're ready
agent.on("start", (): void => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.client.accountIdentifier?.identifier}`);
  console.log(`🔗${getTestUrl(agent)}`);
});

await agent.start();
