import { SignJWT, jwtVerify } from 'jose';
import { IdGenerator, EncryptionUtils } from '../utils/index.js';
import { SessionModel } from '../models/index.js';
import { AuthenticationError, ValidationError } from '../types/index.js';

// JWT token service
export class TokenService {
  constructor(env) {
    this.env = env;
    this.jwtSecret = new TextEncoder().encode(env.JWT_SECRET);
    this.refreshSecret = new TextEncoder().encode(env.REFRESH_TOKEN_SECRET);
  }
  
  async generateAccessToken(payload) {
    return await new SignJWT({
      sub: payload.userId,
      email: payload.email,
      role: payload.role,
      type: 'access'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + (24 * 60 * 60)) // 24 hours
      .sign(this.jwtSecret);
  }
  
  async generateRefreshToken(payload) {
    return await new SignJWT({
      sub: payload.userId,
      type: 'refresh',
      sessionId: payload.sessionId
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)) // 7 days
      .sign(this.refreshSecret);
  }
  
  async verifyAccessToken(token) {
    try {
      const { payload } = await jwtVerify(token, this.jwtSecret);
      
      if (payload.type !== 'access') {
        throw new AuthenticationError('Invalid token type');
      }
      
      return payload;
    } catch (error) {
      if (error.code === 'JWT_EXPIRED') {
        throw new AuthenticationError('Access token expired');
      }
      if (error.code === 'JWT_INVALID') {
        throw new AuthenticationError('Invalid access token');
      }
      throw new AuthenticationError('Token verification failed');
    }
  }
  
  async verifyRefreshToken(token) {
    try {
      const { payload } = await jwtVerify(token, this.refreshSecret);
      
      if (payload.type !== 'refresh') {
        throw new AuthenticationError('Invalid token type');
      }
      
      return payload;
    } catch (error) {
      if (error.code === 'JWT_EXPIRED') {
        throw new AuthenticationError('Refresh token expired');
      }
      if (error.code === 'JWT_INVALID') {
        throw new AuthenticationError('Invalid refresh token');
      }
      throw new AuthenticationError('Refresh token verification failed');
    }
  }
}

// Authentication service
export class AuthService {
  constructor(env) {
    this.env = env;
    this.tokenService = new TokenService(env);
    this.sessionModel = new SessionModel(env.DB, env.CACHE);
  }
  
  async register(userData) {
    const { DatabaseUtils, UserModel } = await import('../models/index.js');
    const userModel = new UserModel(this.env.DB, this.env.CACHE);
    
    // Check if user already exists
    const existingUser = await userModel.findByEmail(userData.email);
    if (existingUser) {
      throw new ValidationError('Email already registered');
    }
    
    // Hash password
    const hashedPassword = await EncryptionUtils.hashPassword(userData.password);
    
    // Create user
    const user = await userModel.create({
      email: userData.email,
      fullName: userData.fullName,
      hashedPassword,
      avatarUrl: userData.avatarUrl,
      role: 'USER',
      status: 'PENDING_VERIFICATION'
    });
    
    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Save verification code
    await DatabaseUtils.executeRun(
      this.env.DB,
      'INSERT OR REPLACE INTO verification_codes (email, code, expires_at) VALUES (?, ?, ?)',
      [userData.email, verificationCode, new Date(Date.now() + 10 * 60 * 1000).toISOString()]
    );
    
    // Send verification email (implement email service)
    await this.sendVerificationEmail(userData.email, verificationCode);
    
    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        status: user.status
      },
      message: 'Registration successful. Please check your email for verification code.'
    };
  }
  
  async verifyEmail(email, code) {
    const { DatabaseUtils, UserModel } = await import('../models/index.js');
    const userModel = new UserModel(this.env.DB, this.env.CACHE);
    
    // Find verification code
    const verification = await DatabaseUtils.executeGet(
      this.env.DB,
      'SELECT * FROM verification_codes WHERE email = ? AND code = ? AND expires_at > ?',
      [email, code, new Date().toISOString()]
    );
    
    if (!verification) {
      throw new ValidationError('Invalid or expired verification code');
    }
    
    // Update user email verification status
    await DatabaseUtils.executeRun(
      this.env.DB,
      'UPDATE users SET email_verified = 1, status = ?, updated_at = ? WHERE email = ?',
      ['ACTIVE', new Date().toISOString(), email]
    );
    
    // Delete verification code
    await DatabaseUtils.executeRun(
      this.env.DB,
      'DELETE FROM verification_codes WHERE email = ?',
      [email]
    );
    
    // Clear cache
    await this.env.CACHE.delete(`user:email:${email}`);
    
    return { verified: true, message: 'Email verified successfully' };
  }
  
  async login(credentials, context) {
    const { UserModel } = await import('../models/index.js');
    const userModel = new UserModel(this.env.DB, this.env.CACHE);
    
    // Find user
    const user = await userModel.findByEmail(credentials.email);
    if (!user || !user.hashed_password) {
      throw new AuthenticationError('Invalid credentials');
    }
    
    // Check email verification
    if (!user.email_verified) {
      throw new AuthenticationError('Please verify your email before logging in');
    }
    
    // Check user status
    if (user.status !== 'ACTIVE') {
      throw new AuthenticationError('Account is not active');
    }
    
    // Verify password
    const isValidPassword = await EncryptionUtils.verifyPassword(
      credentials.password,
      user.hashed_password
    );
    
    if (!isValidPassword) {
      throw new AuthenticationError('Invalid credentials');
    }
    
    // Generate tokens
    const sessionId = IdGenerator.generateSessionId();
    const accessToken = await this.tokenService.generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });
    
    const refreshToken = await this.tokenService.generateRefreshToken({
      userId: user.id,
      sessionId
    });
    
    // Create session
    await this.sessionModel.create({
      userId: user.id,
      token: accessToken,
      refreshToken,
      ttl: credentials.rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000, // 7 days or 24 hours
      ipAddress: context.ip,
      userAgent: context.userAgent
    });
    
    // Update last login
    await userModel.updateLastLogin(user.id);
    
    // Return user data without sensitive info
    const { hashed_password, ...userData } = user;
    
    return {
      user: userData,
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: credentials.rememberMe ? 7 * 24 * 60 * 60 : 24 * 60 * 60 // seconds
      }
    };
  }
  
  async refresh(refreshToken) {
    // Verify refresh token
    const payload = await this.tokenService.verifyRefreshToken(refreshToken);
    
    // Find session
    const session = await this.sessionModel.findByRefreshToken(refreshToken);
    if (!session) {
      throw new AuthenticationError('Invalid refresh token');
    }
    
    // Generate new access token
    const accessToken = await this.tokenService.generateAccessToken({
      userId: session.user_id,
      email: session.email,
      role: session.role
    });
    
    // Update session with new access token
    await DatabaseUtils.executeRun(
      this.env.DB,
      'UPDATE sessions SET token = ? WHERE id = ?',
      [accessToken, session.id]
    );
    
    return {
      accessToken,
      expiresIn: 24 * 60 * 60 // 24 hours
    };
  }
  
  async logout(accessToken) {
    const payload = await this.tokenService.verifyAccessToken(accessToken);
    
    // Find and revoke session
    const session = await this.sessionModel.findByToken(accessToken);
    if (session) {
      await this.sessionModel.revoke(session.id);
    }
    
    return { loggedOut: true };
  }
  
  async logoutAll(userId) {
    await this.sessionModel.revokeAllForUser(userId);
    return { loggedOutAll: true };
  }
  
  async changePassword(userId, passwordData) {
    const { UserModel } = await import('../models/index.js');
    const userModel = new UserModel(this.env.DB, this.env.CACHE);
    
    // Get user with current password
    const user = await DatabaseUtils.executeGet(
      this.env.DB,
      'SELECT hashed_password FROM users WHERE id = ?',
      [userId]
    );
    
    if (!user) {
      throw new NotFoundError('User');
    }
    
    // Verify current password
    const isValidCurrentPassword = await EncryptionUtils.verifyPassword(
      passwordData.currentPassword,
      user.hashed_password
    );
    
    if (!isValidCurrentPassword) {
      throw new AuthenticationError('Current password is incorrect');
    }
    
    // Hash new password
    const hashedNewPassword = await EncryptionUtils.hashPassword(passwordData.newPassword);
    
    // Update password
    await DatabaseUtils.executeRun(
      this.env.DB,
      'UPDATE users SET hashed_password = ?, updated_at = ? WHERE id = ?',
      [hashedNewPassword, new Date().toISOString(), userId]
    );
    
    // Revoke all sessions (force re-login)
    await this.sessionModel.revokeAllForUser(userId);
    
    return { passwordChanged: true };
  }
  
  async forgotPassword(email) {
    const { UserModel } = await import('../models/index.js');
    const userModel = new UserModel(this.env.DB, this.env.CACHE);
    
    // Find user
    const user = await userModel.findByEmail(email);
    if (!user) {
      // Don't reveal if email exists or not
      return { message: 'If an account with this email exists, a password reset link has been sent.' };
    }
    
    // Generate reset token
    const resetToken = IdGenerator.generateSecureToken(32);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
    
    // Save reset token
    await DatabaseUtils.executeRun(
      this.env.DB,
      'INSERT OR REPLACE INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)',
      [email, resetToken, expiresAt]
    );
    
    // Send reset email
    await this.sendPasswordResetEmail(email, resetToken);
    
    return { message: 'If an account with this email exists, a password reset link has been sent.' };
  }
  
  async resetPassword(token, newPassword) {
    // Find valid reset token
    const reset = await DatabaseUtils.executeGet(
      this.env.DB,
      'SELECT * FROM password_resets WHERE token = ? AND expires_at > ?',
      [token, new Date().toISOString()]
    );
    
    if (!reset) {
      throw new ValidationError('Invalid or expired reset token');
    }
    
    // Hash new password
    const hashedPassword = await EncryptionUtils.hashPassword(newPassword);
    
    // Update password
    await DatabaseUtils.executeRun(
      this.env.DB,
      'UPDATE users SET hashed_password = ?, updated_at = ? WHERE email = ?',
      [hashedPassword, new Date().toISOString(), reset.email]
    );
    
    // Delete reset token
    await DatabaseUtils.executeRun(
      this.env.DB,
      'DELETE FROM password_resets WHERE token = ?',
      [token]
    );
    
    // Revoke all sessions
    const user = await UserModel.findByEmail(reset.email);
    if (user) {
      await this.sessionModel.revokeAllForUser(user.id);
    }
    
    return { passwordReset: true };
  }
  
  async sendVerificationEmail(email, code) {
    // Implement email service
    Logger.info('Verification email sent', { email, code });
    return { sent: true };
  }
  
  async sendPasswordResetEmail(email, token) {
    // Implement email service
    Logger.info('Password reset email sent', { email, token });
    return { sent: true };
  }
}

// Google OAuth service
export class GoogleAuthService {
  constructor(env) {
    this.env = env;
    this.tokenService = new TokenService(env);
    this.sessionModel = new SessionModel(env.DB, env.CACHE);
  }
  
  getAuthUrl() {
    const redirectUri = `${this.env.FRONTEND_URL}/auth/google/callback`;
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    
    authUrl.searchParams.set('client_id', this.env.GOOGLE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid profile email');
    authUrl.searchParams.set('prompt', 'select_account');
    
    return authUrl.toString();
  }
  
  async handleCallback(code) {
    const { UserModel } = await import('../models/index.js');
    const userModel = new UserModel(this.env.DB, this.env.CACHE);
    
    const redirectUri = `${this.env.FRONTEND_URL}/auth/google/callback`;
    
    try {
      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          client_id: this.env.GOOGLE_CLIENT_ID,
          client_secret: this.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        })
      });
      
      if (!tokenResponse.ok) {
        throw new Error('Failed to exchange authorization code for token');
      }
      
      const tokenData = await tokenResponse.json();
      
      // Verify ID token
      const userInfoResponse = await fetch(
        `https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${tokenData.id_token}`
      );
      
      if (!userInfoResponse.ok) {
        throw new Error('Failed to verify ID token');
      }
      
      const googleUser = await userInfoResponse.json();
      
      // Find or create user
      let user = await DatabaseUtils.executeGet(
        this.env.DB,
        'SELECT * FROM users WHERE google_id = ?',
        [googleUser.sub]
      );
      
      if (!user) {
        // Check if user exists with same email
        user = await userModel.findByEmail(googleUser.email);
        
        if (user) {
          // Link Google account to existing user
          await DatabaseUtils.executeRun(
            this.env.DB,
            'UPDATE users SET google_id = ?, avatar_url = ?, updated_at = ? WHERE id = ?',
            [googleUser.sub, googleUser.picture, new Date().toISOString(), user.id]
          );
        } else {
          // Create new user
          const userId = IdGenerator.generateId('us');
          await DatabaseUtils.executeRun(
            this.env.DB,
            `INSERT INTO users (id, google_id, email, full_name, avatar_url, role, status, email_verified, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              userId,
              googleUser.sub,
              googleUser.email,
              googleUser.name,
              googleUser.picture,
              'USER',
              'ACTIVE',
              1, // email verified
              new Date().toISOString()
            ]
          );
          
          user = await userModel.findById(userId);
        }
      }
      
      // Generate tokens
      const sessionId = IdGenerator.generateSessionId();
      const accessToken = await this.tokenService.generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role
      });
      
      const refreshToken = await this.tokenService.generateRefreshToken({
        userId: user.id,
        sessionId
      });
      
      // Create session
      await this.sessionModel.create({
        userId: user.id,
        token: accessToken,
        refreshToken,
        ttl: 24 * 60 * 60 * 1000 // 24 hours
      });
      
      return {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          avatarUrl: user.avatar_url,
          role: user.role
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: 24 * 60 * 60
        }
      };
      
    } catch (error) {
      Logger.error('Google OAuth callback error', error);
      throw new AuthenticationError('Google authentication failed');
    }
  }
}

// Import DatabaseUtils for internal use
import { DatabaseUtils } from '../models/index.js';
import { NotFoundError } from '../types/index.js';

export {
  TokenService,
  AuthService,
  GoogleAuthService
};