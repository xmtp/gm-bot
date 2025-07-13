## GM bot

A simple XMTP agent that responds with `gm` to any message it receives.

> [!TIP]
> This example is part of the [XMTP agent examples](https://github.com/ephemeraHQ/xmtp-agent-examples) collection.

## Features

- **High-Volume Processing**: Optimized to handle 600+ concurrent messages
- **Concurrency Control**: Configurable message processing limits
- **Performance Monitoring**: Real-time metrics and logging
- **Graceful Shutdown**: Clean resource cleanup on exit

## Web inbox

Try XMTP using [xmtp.chat](https://xmtp.chat) and sending a message to `gm.xmtp.eth`

![](./screenshot.png)

## Configuration

The bot supports the following environment variables for high-volume processing:

```bash
# Concurrency settings
MAX_CONCURRENT_MESSAGES=100    # Max concurrent message processors
MESSAGE_QUEUE_SIZE=600         # Max messages in processing queue
XMTP_ENV=dev                   # XMTP network (dev, production)
LOGGING_LEVEL=info             # Logging verbosity
```

## Run the agent

```bash
# git clone repo
git clone https://github.com/xmtp/gm-bot.git
# go to the folder
cd gm-bot
# install packages
yarn
# run the agent
yarn dev
```

## Performance

The bot is optimized for high-volume scenarios:
- Processes up to 100 messages concurrently
- Queues up to 600 messages for processing
- Provides real-time performance metrics
- Automatically handles backpressure and resource limits
