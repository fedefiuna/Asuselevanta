import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp, installErrorHandler } from '../server/app.ts';

// La app se crea una sola vez y se reutiliza mientras la función de Vercel siga "caliente".
let appPromise: ReturnType<typeof buildApp> | undefined;

async function buildApp() {
  const app = await createApp();
  installErrorHandler(app);
  return app;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    appPromise ??= buildApp();
    const app = await appPromise;
    app(req as never, res as never);
  } catch (err) {
    appPromise = undefined; // si falló el arranque (por ejemplo DATABASE_URL), se reintenta en la próxima petición
    console.error('No se pudo iniciar la API:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'La API no pudo iniciar. Revisa las variables de entorno en Vercel.' }));
  }
}
