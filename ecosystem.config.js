// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'observabilidade-app',
      script: './app.js',
      watch: true, // reinicia se detectar mudanças
      ignore_watch: ['logs', 'node_modules'],
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production'
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true
    }
  ]
};
