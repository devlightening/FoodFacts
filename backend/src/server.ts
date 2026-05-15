import cors from 'cors';
import express from 'express';

import { createProductsRouter } from './routes/products.routes.js';

const PORT = Number(process.env.PORT ?? 3001);
const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(createRateLimiter());

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    service: 'FoodFacts Product Resolver',
  });
});

app.use('/api/products', createProductsRouter());

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error(error);
  response.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'Ürün çözümleyici beklenmeyen bir hata aldı.',
  });
});

const server = app.listen(PORT, () => {
  console.log(`FoodFacts backend listening on http://localhost:${PORT}`);
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} zaten kullanımda. Çalışan backend'i kapat veya PORT=3002 npm run dev kullan.`);
    process.exit(1);
  }

  throw error;
});

function createRateLimiter() {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  const windowMs = 60_000;
  const maxRequests = 120;

  return (request: express.Request, response: express.Response, next: express.NextFunction) => {
    const key = request.ip ?? 'unknown';
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    bucket.count += 1;

    if (bucket.count > maxRequests) {
      response.status(429).json({
        error: 'RATE_LIMITED',
        message: 'Çok fazla istek gönderildi. Lütfen kısa süre sonra tekrar dene.',
      });
      return;
    }

    next();
  };
}
