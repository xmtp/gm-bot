import { run } from "@xmtp/message-kit";
run(async (context) => {
    // To reply, just call `reply` on the HandlerContext.
    await context.send(`gm`);
}, {
    client: {
        logging: process.env.NODE_ENV === "production" ? "debug" : "off",
    },
});
//# sourceMappingURL=index.js.map