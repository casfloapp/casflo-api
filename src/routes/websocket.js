// src/routes/websocket.js
import { Hono } from 'hono';
import { authenticate } from '../middleware/security.js';

const websocketRoutes = new Hono();

// Get WebSocket connection info
websocketRoutes.get('/info',
  authenticate,
  async (c) => {
    const id = c.env.WEBSOCKET_MANAGER.idFromName('global');
    const stub = c.env.WEBSOCKET_MANAGER.get(id);
    
    const stats = await stub.getStats();
    
    return c.json({
      success: true,
      data: {
        websocketUrl: `wss://${c.req.url.split('//')[1]}/ws`,
        stats
      }
    });
  }
);

// Broadcast message to book room
websocketRoutes.post('/broadcast/:bookId',
  authenticate,
  async (c) => {
    const { bookId } = c.req.param();
    const { message } = await c.req.json();
    const userId = c.get('userId');
    
    const id = c.env.WEBSOCKET_MANAGER.idFromName('global');
    const stub = c.env.WEBSOCKET_MANAGER.get(id);
    
    // Broadcast to specific book room
    await stub.broadcastToRoom(bookId, {
      type: 'broadcast',
      message,
      sentBy: userId,
      timestamp: Date.now()
    });
    
    return c.json({
      success: true,
      message: 'Message broadcasted successfully'
    });
  }
);

export default websocketRoutes;