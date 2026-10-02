import express from 'express';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Increase payload limit for base64 passport images
  app.use(express.json({ limit: '30mb' }));
  app.use(express.urlencoded({ extended: true, limit: '30mb' }));

  // API Route: Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api', (_req, res, next) => {
    // These download endpoints are handled below.
    if (_req.path === '/download-html-app') return next();
    res.status(404).json({ success: false, error: 'Acción no disponible.' });
  });

  // Serve and download standalone HTML app
  app.get('/sqp-para-legal.html', (_req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'sqp-para-legal.html'));
  });
  app.get('/api/download-html-app', (_req, res) => {
    res.download(path.join(process.cwd(), 'public', 'sqp-para-legal.html'), 'sqp-para-legal.html');
  });

  // Vite development middleware or static production serving
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SQP Legal Consulting server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
