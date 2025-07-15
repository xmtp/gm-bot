import { Client, IdentifierKind, type Conversation, XmtpEnv,LogLevel } from "@xmtp/node-sdk";
import "dotenv/config";
import { createSigner, getDbPath, getEncryptionKeyFromHex, validateEnvironment } from "../helpers/client.js";
import { generatePrivateKey } from "viem/accounts";

const { ENCRYPTION_KEY,LOGGING_LEVEL,XMTP_ENV } = validateEnvironment([
    "ENCRYPTION_KEY",
    "LOGGING_LEVEL",
    "XMTP_ENV"
]);

// yarn stress --address 0x362d666308d90e049404d361b29c41bda42dd38b --users 5

interface Config {
  userCount: number;
  botAddress: string;
  timeout: number;
  env: string;
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    userCount: 5,
    botAddress: "",
    timeout: 30 * 1000, // 60 seconds
    env: XMTP_ENV,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === "--users" && nextArg) {
      config.userCount = parseInt(nextArg, 10);
      i++;
    } else if (arg === "--address" && nextArg) {
      config.botAddress = nextArg;
      i++;
    } else if (arg === "--timeout" && nextArg) {
      config.timeout = parseInt(nextArg, 10) * 1000;
      i++;
    } else if (arg === "--env" && nextArg) {
      config.env = nextArg;
      i++;
    }
  }

  return config;
}

async function runStressTest(config: Config): Promise<void> {
  console.log(
    `🚀 Testing ${config.userCount} users against ${config.botAddress}`,
  );

  const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

  // Initialize workers concurrently
  console.log(`📋 Initializing ${config.userCount} workers concurrently...`);
  
  const workerPromises = Array.from({ length: config.userCount }, async (_, i) => {
    const workerKey = generatePrivateKey();
    const signer = createSigner(workerKey);
    const signerIdentifier = (await signer.getIdentifier()).identifier;
    
    const client = await Client.create(signer, { 
      env: config.env as XmtpEnv,
      loggingLevel: LOGGING_LEVEL as LogLevel,
      dbPath: getDbPath(`${config.env}-worker-${i}-${signerIdentifier}`),
      dbEncryptionKey
    });
    
    console.log(`✅ Worker ${i} initialized successfully`);
    return client;
  });
  
  const workers = await Promise.all(workerPromises);
  console.log(`✅ All ${config.userCount} workers initialized successfully`);

  // Run all workers in parallel
  console.log(`🔄 Starting parallel worker execution...`);
  const promises = workers.map((worker, i) => {
    return new Promise<{
      success: boolean;
      newDmTime: number;
      sendTime: number;
      responseTime: number;
    }>((resolve) => {
      let responseReceived = false;
      let sendCompleteTime = 0;
      let sendTime = 0;

      const process = async () => {
        try {
          // 1. Time NewDM creation
          const newDmStart = Date.now();
          const conversation =
            (await worker.conversations.newDmWithIdentifier({
              identifier: config.botAddress,
              identifierKind: IdentifierKind.Ethereum,
            })) as Conversation;
          const newDmTime = Date.now() - newDmStart;
          console.log(`💬 Worker ${i}: DM created in ${newDmTime}ms`);

          console.log(`📡 Worker ${i}: Setting up message stream...`);
          // Set up stream
          worker.conversations.streamAllMessages(
            (error: any, message: any) => {
              if (error) return;

              // Check for bot response
              if (
                message.senderInboxId.toLowerCase() !==
                        worker.inboxId.toLowerCase() &&
                !responseReceived
              ) {
                responseReceived = true;

                // 3. Calculate response time
                const responseTime = Date.now() - sendCompleteTime;
               
                console.log(
                  `✅ Worker ${i}: NewDM=${newDmTime}ms, Send=${sendTime}ms, Response=${responseTime}ms`,
                );
                resolve({ success: true, newDmTime, sendTime, responseTime });
              }
            },
          );

          console.log(`📤 Worker ${i}: Sending test message...`);
          // 2. Time message send
          const sendStart = Date.now();
          await conversation.send(`test-${i}-${Date.now()}`);
          sendTime = Date.now() - sendStart;
          sendCompleteTime = Date.now();
          console.log(`📩 Worker ${i}: Message sent in ${sendTime}ms`);
        } catch (error) {
         console.error(error);
        }
      };

      process().catch(() => {
        resolve({ success: false, newDmTime: 0, sendTime: 0, responseTime: 0 });
      });
    });
  });

  // Wait for all workers with global timeout
  console.log(`⏳ Waiting for all workers to complete...`);
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Test timed out after ${config.timeout}ms`));
    }, config.timeout);
  });

  try {
    const results = await Promise.race([Promise.all(promises), timeoutPromise]);
    console.log(`🏁 All workers completed`);

    const successful = results.filter((r) => r.success);

    console.log(
      `📊 Results: ${successful.length}/${config.userCount} successful (${Math.round((successful.length / config.userCount) * 100)}%)`,
    );

    if (successful.length > 0) {
      const avgNewDm =
        successful.reduce((sum, r) => sum + r.newDmTime, 0) / successful.length;
      const avgSend =
        successful.reduce((sum, r) => sum + r.sendTime, 0) / successful.length;
      const avgResponse =
        successful.reduce((sum, r) => sum + r.responseTime, 0) /
        successful.length;

      console.log(
        `📈 Averages: NewDM=${Math.round(avgNewDm)}ms, Send=${Math.round(avgSend)}ms, Response=${Math.round(avgResponse)}ms`,
      );
    }
  } catch (error) {
    console.log(`❌ Test timed out - gathering partial results...`);
    
    // Collect partial results from completed workers
    const partialResults = await Promise.allSettled(promises);
    const completed = partialResults
      .filter((result): result is PromiseFulfilledResult<{success: boolean; newDmTime: number; sendTime: number; responseTime: number}> => 
        result.status === 'fulfilled')
      .map(result => result.value);
    
    const successful = completed.filter((r) => r.success);
    const completedCount = completed.length;
    const timedOutCount = config.userCount - completedCount;

    console.log(
      `📊 Partial Results: ${successful.length}/${completedCount} successful workers (${completedCount}/${config.userCount} completed, ${timedOutCount} timed out)`,
    );

    if (successful.length > 0) {
      const avgNewDm =
        successful.reduce((sum, r) => sum + r.newDmTime, 0) / successful.length;
      const avgSend =
        successful.reduce((sum, r) => sum + r.sendTime, 0) / successful.length;
      const avgResponse =
        successful.reduce((sum, r) => sum + r.responseTime, 0) /
        successful.length;

      console.log(
        `📈 Averages (from ${successful.length} successful): NewDM=${Math.round(avgNewDm)}ms, Send=${Math.round(avgSend)}ms, Response=${Math.round(avgResponse)}ms`,
      );
    } else {
      console.log(`📈 No successful completions to calculate averages`);
    }
  }
  
  process.exit(0);
}

async function main(): Promise<void> {
  try {
    const config = parseArgs();
    await runStressTest(config);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});
