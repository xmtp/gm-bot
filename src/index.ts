import { run, XMTPContext } from "@xmtp/message-kit";

run(async (context: XMTPContext) => {
  await context.send(`gm`);
});
