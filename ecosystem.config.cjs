const path = require("path");

const projectRoot = path.resolve(__dirname);

module.exports = {
  apps: [
    {
      name: "gm-bot",
      script: "node_modules/.bin/tsx",
      args: "src/index.ts",
      cwd: projectRoot,
      autorestart: true,
      max_memory_restart: "1G",
      error_file: "./logs/pm2-gm-bot-error.log",
      out_file: "./logs/pm2-gm-bot-out.log",
      restart_delay: 4000,
      min_uptime: 1000,
      unstable_restarts: 10000, // CRITICAL: Prevents PM2 from stopping restarts
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
