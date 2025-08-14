// src/routes/auth.js
import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { protect } from '../middleware/auth.js';
import * as q from '../db/queries.js'; // Gunakan alias 'q' agar lebih rapi
import { createSessionToken } from '../lib/jwt.js';
import { sendVerificationEmail } from '../lib/email.js'; // <-- Import service email

const authRoutes = new Hono();

// --- ENDPOINT REGISTRASI MANUAL ---
authRoutes.post('/register', async (c) => {
    const body = await c.req.json();
    if (body.password !== body.confirmPassword) {
        return c.json({ success: false, error: { message: 'Passwords do not match' } }, 400);
    }
    const { data: newUser, error } = await q.createUserWithPassword(c.env.DB, body);
    if (error) {
        return c.json({ success: false, error: { message: error } }, 409);
    }
    
    // Buat & kirim kode OTP
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    await q.saveVerificationCode(c.env.DB, newUser.email, verificationCode);
    const emailResult = await sendVerificationEmail(c, { to: newUser.email, code: verificationCode });
    if (!emailResult.success) {
        // Meskipun email gagal, pendaftaran tetap berhasil. User bisa minta kirim ulang.
        console.error('Registration successful, but OTP email failed to send.');
    }

    return c.json({ 
        success: true, 
        message: 'Registration successful. Please check your email to verify your account.',
        data: newUser 
    }, 201);
});

// --- ENDPOINT VERIFIKASI EMAIL ---
authRoutes.post('/verify-email', async (c) => {
    const { email, code } = await c.req.json();
    const stored = await q.findVerificationCode(c.env.DB, email);

    if (!stored || stored.code !== code) {
        return c.json({ success: false, error: { message: 'Invalid or incorrect verification code.' } }, 400);
    }
    if (new Date(stored.expires_at) < new Date()) {
        return c.json({ success: false, error: { message: 'Verification code has expired.' } }, 400);
    }

    await q.verifyUserEmail(c.env.DB, stored.email);
    await q.deleteVerificationCode(c.env.DB, email); // Hapus kode setelah berhasil digunakan

    return c.json({ success: true, message: 'Email verified successfully.' });
});

// --- ENDPOINT LOGIN MANUAL ---
authRoutes.post('/login', async (c) => {
    const { email, password } = await c.req.json();
    const user = await q.findUserByEmail(c.env.DB, email);
    if (!user || !user.hashed_password) { return c.json({ success: false, error: { message: 'Invalid credentials' } }, 401); }
    if (user.is_email_verified === 0) { return c.json({ success: false, error: { message: 'Please verify your email before logging in' } }, 403); }
    const isMatch = await bcrypt.compare(password, user.hashed_password);
    if (!isMatch) { return c.json({ success: false, error: { message: 'Invalid credentials' } }, 401); }
    const sessionToken = await createSessionToken(c, user.id);
    const { hashed_password, ...userData } = user;
    return c.json({ success: true, data: { sessionToken, user: userData } });
});

// --- [BARU] ENDPOINT REGISTRASI/LOGIN VIA GOOGLE ---
authRoutes.post('/google', async (c) => {
    const { googleToken } = await c.req.json();
    if (!googleToken) {
        return c.json({ success: false, error: { message: 'Google token is required' } }, 400);
    }

    try {
        // Verifikasi token ke server Google
        const response = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${googleToken}`);
        if (!response.ok) {
            return c.json({ success: false, error: { message: 'Invalid Google token' } }, 401);
        }
        const googleUser = await response.json();

        // Cek apakah user sudah ada di database kita
        let user = await q.findUserByGoogleId(c.env.DB, googleUser.sub);

        // Jika tidak ada, buat user baru (Registrasi)
        if (!user) {
            const newUserPayload = {
                google_id: googleUser.sub,
                full_name: googleUser.name,
                email: googleUser.email,
                avatar_url: googleUser.picture
            };
            user = await q.createUserWithGoogle(c.env.DB, newUserPayload);
        }

        // Buat token sesi internal aplikasi kita
        const sessionToken = await createSessionToken(c, user.id);
        
        // Hapus password hash (jika ada) sebelum mengirim data user
        const { hashed_password, ...userData } = user;

        return c.json({ success: true, data: { sessionToken, user: userData } });

    } catch (error) {
        console.error('Google auth error:', error);
        return c.json({ success: false, error: { message: 'An error occurred during Google authentication.' } }, 500);
    }
});

// --- ENDPOINT GET USER ---
authRoutes.get('/users/me', protect, async (c) => {
  const userContext = c.get('user');
  const user = await c.env.DB.prepare('SELECT id, full_name, email, avatar_url, is_email_verified FROM users WHERE id = ?').bind(userContext.id).first();
  if (!user) { return c.json({ success: false, error: { message: 'User not found'}}, 404); }
  return c.json({ success: true, data: user });
});

export default authRoutes;
