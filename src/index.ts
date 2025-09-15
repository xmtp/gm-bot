
import { Agent, createSigner, createUser, getTestUrl, LogLevel,   } from "@xmtp/agent-sdk";
import fs from "fs";

// Load .env file only in local development
if (process.env.NODE_ENV !== 'production') process.loadEnvFile(".env");


  // 2. Spin up the agent
const agent = await Agent.create(createSigner(createUser(process.env.XMTP_WALLET_KEY as `0x${string}`)), {
  appVersion:'gm-bot/1.0.0',
    loggingLevel: "warn" as LogLevel,
  env: process.env.XMTP_DB_ENCRYPTION_KEY as "local" | "dev" | "production",
  dbPath: getDbPath("gm-bot-"+process.env.XMTP_ENV),
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


function getDbPath(description: string = "xmtp") {
  //Checks if the environment is a Railway deployment
  const volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".data/xmtp";
  // Create database directory if it doesn't exist
  if (!fs.existsSync(volumePath)) {
    fs.mkdirSync(volumePath, { recursive: true });
  }
  return `${volumePath}/${process.env.XMTP_ENV}-${description}.db3`;
}