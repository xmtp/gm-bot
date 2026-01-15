import { Agent } from "@xmtp/agent-sdk";

process.loadEnvFile(".env");

const MESSAGE = "PING";
const TIMEOUT_SECONDS = 10;
const STREAM_SETUP_DELAY_MS = 500;

async function waitForResponse(
  agent: Agent,
  conversation: any,
  conversationId: string,
  message: string,
) {
  const stream = await agent.client.conversations.streamAllMessages();
  const startTime = performance.now();

  const responsePromise = (async () => {
    try {
      for await (const msg of stream) {
        if (
          msg.conversationId !== conversationId ||
          msg.senderInboxId.toLowerCase() === agent.client.inboxId.toLowerCase()
        ) {
          continue;
        }
        return msg;
      }
      return null;
    } catch {
      return null;
    }
  })();

  await new Promise((resolve) => setTimeout(resolve, STREAM_SETUP_DELAY_MS));

  await conversation.send(message);
  const sendTime = performance.now() - startTime;

  let timeoutId = null;
  try {
    const timeoutPromise = new Promise<null>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error("Timeout")),
        TIMEOUT_SECONDS * 1000,
      );
    });

    const response = await Promise.race([responsePromise, timeoutPromise]);
    return {
      sendTime,
      responseTime: performance.now() - startTime,
      responseMessage: response,
    };
  } catch {
    return {
      sendTime,
      responseTime: performance.now() - startTime,
      responseMessage: null,
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function main() {
  
  let target: string | undefined;
  const args = process.argv.slice(2);
  
  for (const arg of args) {
    if (arg.startsWith("--target=")) {
      target = arg.split("=")[1];
      break;
    } else if (arg === "--target" && args.indexOf(arg) + 1 < args.length) {
      target = args[args.indexOf(arg) + 1];
      break;
    } else if (!arg.startsWith("--")) {
      target = arg;
      break;
    }
  }
  
  console.log("Parsed target:", target);
  
  if (!target) {
    console.error("Error: Target address required. Use --target=<address> or pass address as argument");
    process.exit(1);
  }
  
  if (!target.startsWith("0x")) {
    console.error("Error: Target must be a valid Ethereum address starting with 0x");
    process.exit(1);
  }

  console.log("Creating agent...");
  const agent = await Agent.createFromEnv({});
  console.log("Agent created, address:", agent.address);
  
  try {
    console.log("Creating DM with target:", target);
    const dm = await agent.createDmWithAddress(target as `0x${string}`);
    console.log("DM created, conversation ID:", dm.id);
    
    console.log("Waiting for response...");
    const result = await waitForResponse(agent, dm, dm.id, MESSAGE);

    console.log(`✅ Message sent (${result.sendTime.toFixed(2)}ms)`);
    if (result.responseMessage) {
      const content =
        typeof result.responseMessage.content === "string"
          ? result.responseMessage.content
          : JSON.stringify(result.responseMessage.content);
      console.log(`📬 Response (${result.responseTime.toFixed(2)}ms): "${content}"`);
    } else {
      console.log(`❌ No response within ${TIMEOUT_SECONDS}s`);
    }
  } catch (error) {
    console.error("Error in main:", error instanceof Error ? error.message : String(error));
    console.error("Stack:", error instanceof Error ? error.stack : "No stack");
    throw error;
  } finally {
    console.log("Stopping agent...");
    await agent.stop();
    process.exit(0);
  }
}

main().catch((error) => {
  console.error("Error:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
