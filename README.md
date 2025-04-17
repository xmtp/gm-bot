# XMTP Number Multiplier Agent

A simple XMTP agent that multiplies received numbers by 2 and sends back the
result.

## Requirements

- Node.js v20 or higher

## Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

3. Generate keys:

```bash
npm run gen:keys
```

This will create a `.env` file with generated wallet and encryption keys.

## Usage

Run the agent in development mode:

```bash
npm run dev
```

Or build and run in production:

```bash
npm run build
npm start
```

## How it works

1. The agent listens for incoming messages on the XMTP network
2. When it receives a message, it tries to parse it as a number
3. If the message is a valid number, the agent multiplies it by 2 and sends back
   the result
4. If the message is not a valid number, the agent sends back an error message

## Testing the agent

To test the agent, you can use any XMTP-compatible client (like
[XMTP Chat](https://xmtp.chat/)) to send messages to the agent's address.

1. Start the agent using `npm run dev`
2. Note the public address shown in the console output
3. Use an XMTP client to send a message to that address
4. Send a number (e.g., "42") and the agent will respond with the number
   multiplied by 2 (e.g., "42 × 2 = 84")

## Environment Configuration

You can configure the agent using these environment variables:

- `XMTP_ENV`: The XMTP environment to connect to (`local`, `dev`, or
  `production`)
- `WALLET_KEY`: The private key for the agent's wallet
- `ENCRYPTION_KEY`: The encryption key for the agent's database

A `.env.example` file is provided as a template.
