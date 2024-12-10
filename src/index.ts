import { run, Agent, XMTPContext } from "@xmtp/message-kit";

const agent: Agent = {
  name: "gm-bot",
  description: "A simple GM bot",
  tag: "@gm",
  skills: [],
  onMessage: async (context: XMTPContext) => {
    await context.send(`gm`);
  },
};

run(agent);
