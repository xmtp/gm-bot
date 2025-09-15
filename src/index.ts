
import { Agent, getTestUrl, LogLevel, XmtpEnv  } from "@xmtp/agent-sdk";
import fs from "fs";

// Load .env file only in local development
if (process.env.NODE_ENV !== 'production') process.loadEnvFile(".env");


  // 2. Spin up the agent
const agent = await Agent.createFromEnv({
  appVersion:'gm-bot/1.0.0',
  env: process.env.XMTP_ENV as XmtpEnv  ,
  loggingLevel: "warn" as LogLevel,
  dbPath: getDbPath()
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



export function getDbPath(description: string = "xmtp"): string {
  // Checks if the environment is a Railway deployment
  const volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".data/xmtp";
  // Create database directory if it doesn't exist
  if (!fs.existsSync(volumePath)) {
    fs.mkdirSync(volumePath, { recursive: true });
  }
  return `${volumePath}/${process.env.XMTP_ENV}-${description}.db3`;
}
