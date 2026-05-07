import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { authRouter } from './routes/auth';
import { tlRouter } from './routes/tl';
import { aseRouter } from './routes/ase';
import { zbmRouter } from './routes/zbm';
import { hsdRouter } from './routes/hsd';
import { adminRouter } from './routes/admin';
import { listerRouter } from './routes/lister';
import { startAlertCron } from './services/alerts';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/tl', tlRouter);
app.use('/api/v1/ase', aseRouter);
app.use('/api/v1/zbm', zbmRouter);
app.use('/api/v1/hsd', hsdRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/lister', listerRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`TL Tracker API running on port ${PORT}`);
  startAlertCron();
});

export default app;
