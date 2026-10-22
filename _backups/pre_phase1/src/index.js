import app from './app.js';

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`[ArchAI Server] Server is running on http://localhost:${PORT}`);
  console.log(`[ArchAI Server] Health check available at http://localhost:${PORT}/api/health`);
});
