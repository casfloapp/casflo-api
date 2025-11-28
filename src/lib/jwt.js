// src/lib/jwt.js
import { sign, verify } from 'hono/jwt';

// Fungsi untuk membuat token sesi baru setelah user berhasil login
export const createSessionToken = async (c, userId) => {
  const payload = {
    sub: userId, // 'sub' (subject) adalah standar klaim untuk ID user
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7), // Token berlaku selama 7 hari
  };
  // JWT_SECRET adalah variabel rahasia yang kita set di environment Worker
  const token = await sign(payload, c.env.JWT_SECRET);
  return token;
};

// Fungsi untuk memverifikasi token yang masuk
export const verifySessionToken = async (c, token) => {
  try {
    const decodedPayload = await verify(token, c.env.JWT_SECRET);
    return decodedPayload;
  } catch (error) {
    return null; // Token tidak valid atau kedaluwarsa
  }
};