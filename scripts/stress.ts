import {
  Client,
  IdentifierKind,
  type Conversation,
  type XmtpEnv,
} from "@xmtp/node-sdk";
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import {
  createSigner,
  generateEncryptionKeyHex,
  getDbPath,
  getEncryptionKeyFromHex,
  validateEnvironment,
} from "../helpers/client";
import { generatePrivateKey } from "viem/accounts";

// yarn stress --address 0x362d666308d90e049404d361b29c41bda42dd38b --users 5
// yarn stress --address 0x362d666308d90e049404d361b29c41bda42dd38b --users 5 --env production
const { XMTP_ENV, ADDRESS } = validateEnvironment(["XMTP_ENV", "ADDRESS"]);

interface Config {
  userCount: number;
  timeout: number;
  env: string;
  address: string;
  tresshold: number;
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    userCount: 5,
    timeout: 30 * 1000, // 120 seconds - increased for XMTP operations
    env: XMTP_ENV,
    address: ADDRESS,
    tresshold: 95,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === "--address" && nextArg) {
      config.address = nextArg;
      i++;
    }
    if (arg === "--env" && nextArg) {
      config.env = nextArg;
      i++;
    }
    if (arg === "--users" && nextArg) {
      config.userCount = parseInt(nextArg, 10);
      i++;
    }
    if (arg === "--tresshold" && nextArg) {
      config.tresshold = parseInt(nextArg, 10);
      i++;
    }
  }

  return config;
}

function cleanupStressDatabases(env: string): void {
  const volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".data/xmtp";
  const dataDir = path.resolve(volumePath);

  if (!fs.existsSync(dataDir)) {
    console.log(`🧹 No data directory found at ${dataDir}, skipping cleanup`);
    return;
  }

  const files = fs.readdirSync(dataDir);
  const stressFiles = files.filter((file) => file.startsWith(`stress-`));

  if (stressFiles.length === 0) {
    console.log(`🧹 No stress test database files found for env: ${env}`);
    return;
  }

  console.log(
    `🧹 Cleaning up ${stressFiles.length} stress test database files...`,
  );

  for (const file of stressFiles) {
    const filePath = path.join(dataDir, file);
    fs.unlinkSync(filePath);
  }

  console.log(
    `🗑️  Removed: ${stressFiles.length} stress test database files`,
  );
}

async function runStressTest(config: Config): Promise<void> {
  // Clean up previous stress test database files
  cleanupStressDatabases(config.env);

  const dbEncryptionKey = getEncryptionKeyFromHex(generateEncryptionKeyHex());

  // Initialize workers concurrently
  const workerPromises = Array.from(
    { length: config.userCount },
    async (_, i) => {
      const workerKey = generatePrivateKey();
      const signer = createSigner(workerKey);
      const signerIdentifier = (await signer.getIdentifier()).identifier;

      const client = await Client.create(signer, {
        env: config.env as XmtpEnv,
        dbPath: getDbPath(
          `stress-${config.env}-worker-${i}-${signerIdentifier}`,
        ),
        dbEncryptionKey,
      }      );

      return client;
    },
  );

  const workers = await Promise.all(workerPromises);

  // Run all workers in parallel

  // Shared counters
  let totalMessagesSent = 0;
  let completedWorkers = 0;
  let firstMessageTime: number | null = null;
  let lastMessageTime: number | null = null;
  

  const promises = workers.map(async (worker, i) => {
    // 1. Time NewDM creation
    const newDmStart = Date.now();
    const conversation = (await worker.conversations.newDmWithIdentifier({
      identifier: config.address,
      identifierKind: IdentifierKind.Ethereum,
    })) as Conversation;
    const newDmTime = Date.now() - newDmStart;
    console.log(`💬 Worker ${i}: DM created in ${newDmTime}ms`);

    console.log(`📤 Worker ${i}: Sending test message...`);
    // 2. Time message send
    const sendStart = Date.now();
    await conversation.send(`test-${i}-${Date.now()}`);
    totalMessagesSent++;
    const sendTime = Date.now() - sendStart;
    
    // Track first and last message times
    if (firstMessageTime === null) {
      firstMessageTime = sendStart;
    }
    lastMessageTime = Date.now();
    
    console.log(
      `📩 Worker ${i}: Message sent in ${sendTime}ms (Total sent: ${totalMessagesSent})`,
    );

    return {
      success: true,
      newDmTime,
      sendTime,
    };
  });

  // Wait for all workers with global timeout and 95% success monitoring
  const finalResults = await Promise.race([
    Promise.all(promises),
  ]);

  const successful = finalResults.filter((r) => r.success);
  const successRate = (successful.length / config.userCount) * 100;

  if (successful.length > 0) {
    const avgNewDm =
      successful.reduce((sum, r) => sum + r.newDmTime, 0) / successful.length;
    const avgSend =
      successful.reduce((sum, r) => sum + r.sendTime, 0) / successful.length;
    
    // Log first and last message times
    if (firstMessageTime !== null && lastMessageTime !== null) {
      const firstMessageDate = new Date(firstMessageTime);
      const lastMessageDate = new Date(lastMessageTime);
      const duration = lastMessageTime - firstMessageTime;
      
      console.log(
        `First sent:  ${firstMessageDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })}                    (+0s)`
      );
      console.log(
        `Last sent:   ${lastMessageDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}                        (+${Math.round(duration / 1000)}s)`
      );
    }
  }
}
    
async function main(): Promise<void> {
  const config = parseArgs();
  await runStressTest(config);
}

main();
