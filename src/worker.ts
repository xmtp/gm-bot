



interface SendTask {
  conversationId: string;
  message: string;
  workerId: number;
  env: {
    WALLET_KEY: string;
    ENCRYPTION_KEY: string;
    XMTP_ENV: string;
  };
}



export default async function sendMessage({ message, conversationId, workerId, env }: SendTask) {
  try {
    console.log('received message', workerId )
  } catch (error) {
    console.error(`Send Worker ${workerId}: Error sending message:`, error);
  }
} 