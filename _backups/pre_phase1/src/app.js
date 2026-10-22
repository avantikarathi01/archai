import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import apiRoutes from './routes/api.js';

dotenv.config();

const app = express();

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Configure CORS for local development
const allowedOrigins = [
  CLIENT_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev mode for smooth development
    },
    credentials: true,
  })
);

app.use(express.json());

// Mount API router
app.use('/api', apiRoutes);

// Root welcome endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'ArchAI API',
    status: 'online',
    version: '1.0.0',
    documentation: 'Welcome to ArchAI API. Use /api/health to inspect system status.',
  });
});

// GET /api/health endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'archai-server',
    message: 'ArchAI Backend API is up and running smoothly.',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
  });
});

export default app;
