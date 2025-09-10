import "dotenv/config";

import { getDbPath } from "../helpers/client";
import { Agent, createSigner, createUser, getTestUrl } from "@xmtp/agent-sdk";

// 2. Spin up the agent
const agent = await Agent.create(createSigner(createUser()), {
  env: process.env.XMTP_ENV as "local" | "dev" | "production", // or 'production'
  dbPath: getDbPath(`echo-bot`),
  appVersion: "echo/1.0.0",
});

let count = 0;

agent.on("text", async (ctx : any) => {
  await ctx.conversation.send("gm: " + ctx.message.content);  
  count++;
});

// 4. Log when we're ready
agent.on("start", () => {
  console.log(`We are online: ${getTestUrl(agent)}`);
});

await agent.start();

