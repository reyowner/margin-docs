// Vercel's Node.js runtime discovers serverless functions in /api.
// Re-export the shared HTTP server so its WebSocket upgrade handler is retained.
export { default } from '../index.js';
