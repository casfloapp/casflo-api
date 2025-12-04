// src/durable-objects/websocket-manager.js
export class WebSocketManager {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sockets = new Map();
    this.rooms = new Map();
  }

  // Handle WebSocket connections
  async fetch(request) {
    const url = new URL(request.url);
    
    // Upgrade WebSocket connection
    if (url.pathname === '/ws') {
      return this.handleWebSocket(request);
    }
    
    return new Response('Not Found', { status: 404 });
  }

  async handleWebSocket(request) {
    const { 0: client, 1: server } = new WebSocketPair();
    const sessionId = crypto.randomUUID();
    
    // Accept the WebSocket connection
    server.accept();
    
    // Store connection
    this.sockets.set(sessionId, {
      socket: server,
      userId: null,
      bookId: null,
      connectedAt: Date.now()
    });
    
    // Handle messages
    server.addEventListener('message', (event) => {
      this.handleMessage(sessionId, event.data);
    });
    
    // Handle disconnection
    server.addEventListener('close', () => {
      this.handleDisconnect(sessionId);
    });
    
    // Send welcome message
    server.send(JSON.stringify({
      type: 'connected',
      sessionId,
      timestamp: Date.now()
    }));
    
    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  async handleMessage(sessionId, data) {
    try {
      const message = JSON.parse(data);
      const connection = this.sockets.get(sessionId);
      
      if (!connection) return;
      
      switch (message.type) {
        case 'authenticate':
          await this.handleAuthenticate(sessionId, message.token);
          break;
          
        case 'join_book':
          await this.handleJoinBook(sessionId, message.bookId);
          break;
          
        case 'leave_book':
          await this.handleLeaveBook(sessionId, message.bookId);
          break;
          
        case 'transaction_update':
          await this.handleTransactionUpdate(sessionId, message.data);
          break;
          
        default:
          connection.socket.send(JSON.stringify({
            type: 'error',
            message: 'Unknown message type'
          }));
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  }

  async handleAuthenticate(sessionId, token) {
    try {
      // Verify JWT token
      const { payload } = await jwtVerify(token, new TextEncoder().encode(this.env.JWT_SECRET));
      
      const connection = this.sockets.get(sessionId);
      if (connection) {
        connection.userId = payload.sub;
        connection.socket.send(JSON.stringify({
          type: 'authenticated',
          userId: payload.sub
        }));
      }
    } catch (error) {
      const connection = this.sockets.get(sessionId);
      if (connection) {
        connection.socket.send(JSON.stringify({
          type: 'authentication_error',
          message: 'Invalid token'
        }));
      }
    }
  }

  async handleJoinBook(sessionId, bookId) {
    const connection = this.sockets.get(sessionId);
    if (!connection || !connection.userId) return;
    
    // Leave previous room
    if (connection.bookId) {
      await this.handleLeaveBook(sessionId, connection.bookId);
    }
    
    // Join new room
    connection.bookId = bookId;
    
    if (!this.rooms.has(bookId)) {
      this.rooms.set(bookId, new Set());
    }
    this.rooms.get(bookId).add(sessionId);
    
    connection.socket.send(JSON.stringify({
      type: 'joined_book',
      bookId
    }));
    
    // Notify other users in the room
    this.broadcastToRoom(bookId, {
      type: 'user_joined',
      userId: connection.userId,
      timestamp: Date.now()
    }, sessionId);
  }

  async handleLeaveBook(sessionId, bookId) {
    const connection = this.sockets.get(sessionId);
    if (!connection) return;
    
    if (this.rooms.has(bookId)) {
      this.rooms.get(bookId).delete(sessionId);
      
      // Remove empty room
      if (this.rooms.get(bookId).size === 0) {
        this.rooms.delete(bookId);
      }
    }
    
    connection.bookId = null;
    
    // Notify other users
    this.broadcastToRoom(bookId, {
      type: 'user_left',
      userId: connection.userId,
      timestamp: Date.now()
    }, sessionId);
  }

  async handleTransactionUpdate(sessionId, transactionData) {
    const connection = this.sockets.get(sessionId);
    if (!connection || !connection.bookId) return;
    
    // Broadcast transaction update to all users in the book
    this.broadcastToRoom(connection.bookId, {
      type: 'transaction_updated',
      data: transactionData,
      updatedBy: connection.userId,
      timestamp: Date.now()
    });
  }

  async handleDisconnect(sessionId) {
    const connection = this.sockets.get(sessionId);
    if (!connection) return;
    
    // Leave room if in one
    if (connection.bookId) {
      await this.handleLeaveBook(sessionId, connection.bookId);
    }
    
    // Remove connection
    this.sockets.delete(sessionId);
  }

  broadcastToRoom(bookId, message, excludeSessionId = null) {
    const room = this.rooms.get(bookId);
    if (!room) return;
    
    const messageStr = JSON.stringify(message);
    
    for (const sessionId of room) {
      if (sessionId !== excludeSessionId) {
        const connection = this.sockets.get(sessionId);
        if (connection && connection.socket.readyState === 1) { // WebSocket.OPEN
          connection.socket.send(messageStr);
        }
      }
    }
  }

  // Get connection stats
  getStats() {
    return {
      totalConnections: this.sockets.size,
      totalRooms: this.rooms.size,
      connections: Array.from(this.sockets.values()).map(conn => ({
        userId: conn.userId,
        bookId: conn.bookId,
        connectedAt: conn.connectedAt
      }))
    };
  }
}

// Import jwtVerify for authentication
import { jwtVerify } from 'jose';