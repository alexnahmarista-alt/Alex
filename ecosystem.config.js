// Configuración para PM2 (alternativa a Docker para correr el proceso en un VPS).
// Uso:  pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'castillos-pos',
      script: 'src/server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
