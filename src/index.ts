import { run, HandlerContext } from "@xmtp/message-kit";

run(async (context: HandlerContext) => {
  await context.send(`gm`);
});
