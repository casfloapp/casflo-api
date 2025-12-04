// src/middleware/auth.js
import { verifySessionToken } from '../lib/jwt.js';

export const protect = async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: { message: 'Unauthorized' } }, 401);
  }

  const token = authHeader.split(' ')[1];
  const decoded = await verifySessionToken(c, token);

  if (!decoded) {
    return c.json({ success: false, error: { message: 'Invalid or expired token' } }, 401);
  }

  // Simpan payload (berisi user ID) di konteks untuk digunakan di rute
  c.set('user', { id: decoded.sub });

  await next();
};