import Fastify from 'fastify';
import './types';

const app = Fastify({ logger: true });

app.decorateRequest('userId', null);

const { registerRoutes } = await import('./routes');
await registerRoutes(app);

try {
  await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
