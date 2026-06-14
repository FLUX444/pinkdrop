/** PM2: API + Telegram-бот на VPS */
module.exports = {
  apps: [
    {
      name: 'pinkdrop-api',
      script: 'server/index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'pinkdrop-bot',
      script: 'BOT TG/main.py',
      interpreter: 'python3',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_memory_restart: '256M',
    },
  ],
};
