module.exports = {
  apps: [
    {
      name: 'pinkdrop-api',
      script: 'server/index.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'pinkdrop-bot',
      script: 'scripts/start-bot.sh',
      interpreter: 'bash',
      cwd: __dirname,
    },
  ],
};
