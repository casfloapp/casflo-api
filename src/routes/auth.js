import { Hono } from 'hono';
import { AuthService, GoogleAuthService } from '../services/auth.js';
import { authenticate, validate } from '../middleware/security.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  UserRegistrationSchema,
  UserLoginSchema,
  PasswordChangeSchema,
  IdParamSchema
} from '../types/schemas.js';

const authRoutes = new Hono();

// Initialize services
const getAuthService = (c) => new AuthService(c.env);
const getGoogleAuthService = (c) => new GoogleAuthService(c.env);

// User registration
authRoutes.post('/register',
  validate(UserRegistrationSchema),
  asyncHandler(async (c) => {
    const authService = getAuthService(c);
    const userData = c.get('validatedData');
    
    const context = {
      ip: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
      userAgent: c.req.header('User-Agent') || 'unknown'
    };
    
    const result = await authService.register(userData);
    
    return c.json({
      success: true,
      message: result.message,
      data: {
        user: result.user
      }
    }, 201);
  })
);

// Email verification
authRoutes.post('/verify-email',
  asyncHandler(async (c) => {
    const { email, code } = await c.req.json();
    
    if (!email || !code) {
      return c.json({
        success: false,
        error: 'Email and verification code are required',
        code: 'MISSING_REQUIRED_FIELDS'
      }, 400);
    }
    
    const authService = getAuthService(c);
    const result = await authService.verifyEmail(email, code);
    
    return c.json({
      success: true,
      message: result.message,
      data: { verified: result.verified }
    });
  })
);

// Resend verification code
authRoutes.post('/resend-verification',
  asyncHandler(async (c) => {
    const { email } = await c.req.json();
    
    if (!email) {
      return c.json({
        success: false,
        error: 'Email is required',
        code: 'MISSING_EMAIL'
      }, 400);
    }
    
    const authService = getAuthService(c);
    
    // Generate new verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Save verification code
    await c.env.DB.prepare(
      'INSERT OR REPLACE INTO verification_codes (email, code, expires_at) VALUES (?, ?, ?)'
    ).bind(email, verificationCode, new Date(Date.now() + 10 * 60 * 1000).toISOString()).run();
    
    // Send verification email
    await authService.sendVerificationEmail(email, verificationCode);
    
    return c.json({
      success: true,
      message: 'A new verification code has been sent to your email'
    });
  })
);

// User login
authRoutes.post('/login',
  validate(UserLoginSchema),
  asyncHandler(async (c) => {
    const authService = getAuthService(c);
    const credentials = c.get('validatedData');
    
    const context = {
      ip: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
      userAgent: c.req.header('User-Agent') || 'unknown'
    };
    
    const result = await authService.login(credentials, context);
    
    return c.json({
      success: true,
      message: 'Login successful',
      data: result
    });
  })
);

// Refresh access token
authRoutes.post('/refresh',
  asyncHandler(async (c) => {
    const { refreshToken } = await c.req.json();
    
    if (!refreshToken) {
      return c.json({
        success: false,
        error: 'Refresh token is required',
        code: 'MISSING_REFRESH_TOKEN'
      }, 400);
    }
    
    const authService = getAuthService(c);
    const result = await authService.refresh(refreshToken);
    
    return c.json({
      success: true,
      message: 'Token refreshed successfully',
      data: result
    });
  })
);

// User logout
authRoutes.post('/logout',
  authenticate,
  asyncHandler(async (c) => {
    const authService = getAuthService(c);
    const token = c.req.header('Authorization')?.substring(7);
    
    await authService.logout(token);
    
    return c.json({
      success: true,
      message: 'Logout successful'
    });
  })
);

// Logout from all devices
authRoutes.post('/logout-all',
  authenticate,
  asyncHandler(async (c) => {
    const authService = getAuthService(c);
    const userId = c.get('userId');
    
    await authService.logoutAll(userId);
    
    return c.json({
      success: true,
      message: 'Logged out from all devices successfully'
    });
  })
);

// Change password
authRoutes.post('/change-password',
  authenticate,
  validate(PasswordChangeSchema),
  asyncHandler(async (c) => {
    const authService = getAuthService(c);
    const passwordData = c.get('validatedData');
    const userId = c.get('userId');
    
    const result = await authService.changePassword(userId, passwordData);
    
    return c.json({
      success: true,
      message: 'Password changed successfully. Please login again.',
      data: { passwordChanged: result.passwordChanged }
    });
  })
);

// Forgot password
authRoutes.post('/forgot-password',
  asyncHandler(async (c) => {
    const { email } = await c.req.json();
    
    if (!email) {
      return c.json({
        success: false,
        error: 'Email is required',
        code: 'MISSING_EMAIL'
      }, 400);
    }
    
    const authService = getAuthService(c);
    const result = await authService.forgotPassword(email);
    
    return c.json({
      success: true,
      message: result.message
    });
  })
);

// Reset password
authRoutes.post('/reset-password',
  asyncHandler(async (c) => {
    const { token, newPassword } = await c.req.json();
    
    if (!token || !newPassword) {
      return c.json({
        success: false,
        error: 'Reset token and new password are required',
        code: 'MISSING_REQUIRED_FIELDS'
      }, 400);
    }
    
    const authService = getAuthService(c);
    const result = await authService.resetPassword(token, newPassword);
    
    return c.json({
      success: true,
      message: 'Password reset successful. Please login with your new password.',
      data: { passwordReset: result.passwordReset }
    });
  })
);

// Google OAuth
authRoutes.get('/google',
  asyncHandler(async (c) => {
    const googleAuthService = getGoogleAuthService(c);
    const authUrl = googleAuthService.getAuthUrl();
    
    return c.json({
      success: true,
      data: {
        authUrl,
        message: 'Redirect to Google for authentication'
      }
    });
  })
);

// Google OAuth callback
authRoutes.post('/google/callback',
  asyncHandler(async (c) => {
    const { code } = await c.req.json();
    
    if (!code) {
      return c.json({
        success: false,
        error: 'Authorization code is required',
        code: 'MISSING_AUTH_CODE'
      }, 400);
    }
    
    const googleAuthService = getGoogleAuthService(c);
    const result = await googleAuthService.handleCallback(code);
    
    return c.json({
      success: true,
      message: 'Google authentication successful',
      data: result
    });
  })
);

// Get current user info
authRoutes.get('/me',
  authenticate,
  asyncHandler(async (c) => {
    const user = c.get('user');
    
    return c.json({
      success: true,
      data: {
        user
      }
    });
  })
);

// Get user sessions
authRoutes.get('/sessions',
  authenticate,
  asyncHandler(async (c) => {
    const userId = c.get('userId');
    
    const sessions = await c.env.DB.prepare(`
      SELECT id, ip_address, user_agent, created_at, expires_at, last_used_at
      FROM sessions
      WHERE user_id = ? AND expires_at > ?
      ORDER BY created_at DESC
    `).bind(userId, new Date().toISOString()).all();
    
    return c.json({
      success: true,
      data: {
        sessions: sessions.results || []
      }
    });
  })
);

// Revoke specific session
authRoutes.delete('/sessions/:id',
  authenticate,
  validate(IdParamSchema, 'param'),
  asyncHandler(async (c) => {
    const { id } = c.get('validatedData');
    const userId = c.get('userId');
    
    // Verify session belongs to user
    const session = await c.env.DB.prepare(`
      SELECT id FROM sessions WHERE id = ? AND user_id = ?
    `).bind(id, userId).first();
    
    if (!session) {
      return c.json({
        success: false,
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      }, 404);
    }
    
    // Revoke session
    await c.env.DB.prepare(`
      UPDATE sessions SET expires_at = ? WHERE id = ?
    `).bind(new Date().toISOString(), id).run();
    
    return c.json({
      success: true,
      message: 'Session revoked successfully'
    });
  })
);

export default authRoutes;