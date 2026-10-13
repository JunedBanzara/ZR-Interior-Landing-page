import { defineConfig, loadEnv } from 'vite';
import { handleApiRequest } from './server/api.js';

export default defineConfig(({ mode }) => {
  // Load environment variables from .env
  const env = loadEnv(mode, process.cwd(), '');

  for (const key of Object.keys(env)) {
    process.env[key] = env[key];
  }

  return {
    server: {
      port: 5173,
      open: false,
      cors: true,
      watch: {
        ignored: ['**/data/**', '**/assets/images/**', '**/scratch/**']
      }
    },
    plugins: [
      {
        name: 'zr-api-backend-middleware',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url && req.url.startsWith('/api/')) {
              try {
                await handleApiRequest(req, res);
              } catch (err) {
                console.error('API Middleware Error:', err);
                if (!res.headersSent) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: err.message }));
                }
              }
            } else {
              next();
            }
          });
        }
      }
    ]
  };
});
