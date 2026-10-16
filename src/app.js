import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/authRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import { notFound, errorHandler } from './middlewares/error.js';

export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '20kb' }));
app.get('/', (req, res) => res.json({ success: true, message: 'TaskFlow API is running', docs: '/api/v1/health' }));
app.get('/api/v1/health', (req, res) => res.json({ success: true, status: 'ok' }));
app.use('/api/v1', rateLimit({
  windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests; try later' } },
}));
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use(notFound);
app.use(errorHandler);
