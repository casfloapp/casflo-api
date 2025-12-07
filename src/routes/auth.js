// src/routes/auth.js
import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { protect } from '../middleware/auth.js';
import * as q from '../db/queries.js';
import { createSessionToken } from '../lib/jwt.js';
import { sendVerificationEmail } from '../lib/email.js';

const authRoutes = new Hono();

// --- ENDPOINT REGISTRASI & LOGIN MANUAL ---
authRoutes.post('/register', async (c) => {
    const body = await c.req.json();
    if (body.password !== body.confirmPassword) {
        return c.json({ success: false, error: { message: 'Passwords do not match' } }, 400);
    }
    const { data: newUser, error } = await q.createUserWithPassword(c.env.DB, body);
    if (error) {
        return c.json({ success: false, error: { message: error } }, 409);
    }
    
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    await q.saveVerificationCode(c.env.DB, newUser.email, verificationCode);
    const emailResult = await sendVerificationEmail(c, { to: newUser.email, code: verificationCode });
    if (!emailResult.success) {
        console.error('Registration successful, but OTP email failed to send.');
    }

    return c.json({ 
        success: true, 
        message: 'Registration successful. Please check your email to verify your account.',
        data: newUser 
    }, 201);
});

authRoutes.post('/verify-email', async (c) => {
    const { email, code } = await c.req.json();
    const stored = await q.findVerificationCode(c.env.DB, email);

    if (!stored || stored.code !== code || new Date(stored.expires_at) < new Date()) {
        return c.json({ success: false, error: { message: 'Invalid or expired verification code.' } }, 400);
    }

    await q.verifyUserEmail(c.env.DB, stored.email);
    await q.deleteVerificationCode(c.env.DB, email);

    return c.json({ success: true, message: 'Email verified successfully.' });
});

// [BARU] Endpoint untuk mengirim ulang kode verifikasi
authRoutes.post('/resend-verification', async (c) => {
    const { email } = await c.req.json();
    if (!email) {
        return c.json({ success: false, error: { message: 'Email is required.' } }, 400);
    }

    // Cek apakah pengguna ada
    const user = await q.findUserByEmail(c.env.DB, email);
    if (!user) {
        // Keamanan: Jangan beritahu jika email tidak ada.
        return c.json({ success: true, message: 'If a user with this email exists, a new code has been sent.' });
    }
    
    // Cek jika email sudah terverifikasi
    if (user.is_email_verified) {
        return c.json({ success: false, error: { message: 'Email is already verified.' } }, 400);
    }

    // Buat kode baru, simpan, dan kirim email (logika yang sama seperti /register)
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    await q.saveVerificationCode(c.env.DB, user.email, verificationCode);
    const emailResult = await sendVerificationEmail(c, { to: user.email, code: verificationCode });

    if (!emailResult.success) {
        console.error('Failed to resend OTP email.');
        return c.json({ success: false, error: { message: 'Failed to send email. Please try again later.' } }, 500);
    }

    return c.json({ success: true, message: 'A new verification code has been sent.' });
});


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


// --- ALUR OTENTIKASI GOOGLE ---
authRoutes.get('/google', async (c) => {
    // ... (kode Anda yang sudah ada)
// ... (sisa kode /google dan /google/callback Anda)
// ...
    const googleClientId = c.env.GOOGLE_CLIENT_ID;
    if (!googleClientId) {
        return c.json({ success: false, error: { message: 'Google Client ID not configured.' } }, 500);
    }
    const redirectUri = 'https://api.casflo.id/api/v1/auth/google/callback';

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', googleClientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid profile email');
    authUrl.searchParams.set('prompt', 'select_account');

    return c.redirect(authUrl.toString());
});

authRoutes.get('/google/callback', async (c) => {
    const { code } = c.req.query();
    const redirectUri = 'https://api.casflo.id/api/v1/auth/google/callback';

    if (!code) {
        return c.redirect('https://app.casflo.id/login?error=google_auth_failed');
    }

    try {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: code,
                client_id: c.env.GOOGLE_CLIENT_ID,
                client_secret: c.env.GOOGLE_CLIENT_SECRET,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code'
            })
        });

        if (!tokenResponse.ok) {
            console.error("Google Token Exchange Error:", await tokenResponse.text());
            throw new Error('Failed to exchange authorization code for token.');
        }

        const tokenData = await tokenResponse.json();
        const idToken = tokenData.id_token;

        const userInfoResponse = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${idToken}`);
        if (!userInfoResponse.ok) {
            throw new Error('Failed to verify ID token.');
        }
        
        const googleUser = await userInfoResponse.json();

        let user = await q.findUserByGoogleId(c.env.DB, googleUser.sub);
        if (!user) {
            const newUserPayload = {
                google_id: googleUser.sub,
                full_name: googleUser.name,
                email: googleUser.email,
                avatar_url: googleUser.picture
            };
            user = await q.createUserWithGoogle(c.env.DB, newUserPayload);
        }

        const sessionToken = await createSessionToken(c, user.id);
        return c.redirect(`https://app.casflo.id/auth/callback?token=${sessionToken}`);

    } catch (error) {
        console.error('Google callback error:', error);
        return c.redirect('https://app.casflo.id/login?error=google_callback_failed');
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

