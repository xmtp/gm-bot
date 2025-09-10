
import { Agent, getTestUrl, type LogLevel  } from "@xmtp/agent-sdk";
import fs from "fs";

process.loadEnvFile(".env");

  // 2. Spin up the agent
const agent = await Agent.createFromEnv({
  appVersion:'gm-bot/1.0.0',
  loggingLevel: "warn" as LogLevel,
  dbPath: getDbPath("gm-bot-"+process.env.XMTP_ENV),
});

let count = 0;

agent.on("text", async (ctx : any) => {
  await ctx.conversation.send("gm: " + ctx.message.content);
  count++;
});

// 4. Log when we're ready
agent.on("start", () => {
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