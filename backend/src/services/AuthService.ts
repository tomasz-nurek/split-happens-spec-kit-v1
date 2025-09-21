import jwt from 'jsonwebtoken';
import { config } from 'dotenv';

// Load environment variables
config();

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResult {
  token: string;
  user: {
    id: number;
    name: string;
    role: string;
  };
}

export interface TokenPayload {
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

export class AuthService {
  private jwtSecret: string;
  private adminUsername: string;
  private adminPassword: string;
  private tokenBlacklist: Set<string>;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'fallback_secret_key';
    this.adminUsername = process.env.ADMIN_USERNAME || 'admin';
    this.adminPassword = process.env.ADMIN_PASSWORD || 'password123';
    this.tokenBlacklist = new Set();

    if (!process.env.JWT_SECRET) {
      console.warn('Warning: JWT_SECRET not set in environment variables');
    }
  }

  /**
   * Authenticate admin user with credentials
   */
  async login(credentials: LoginCredentials): Promise<LoginResult | null> {
    const { username, password } = credentials;

    // Validate required fields
    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    // Check credentials against admin user
    if (username !== this.adminUsername || password !== this.adminPassword) {
      return null; // Invalid credentials
    }

    // Generate JWT token
    const payload: TokenPayload = {
      username: this.adminUsername,
      role: 'admin'
    };

    const token = jwt.sign(payload, this.jwtSecret, {
      expiresIn: '24h'
    });

    return { 
      token,
      user: {
        id: 1, // Admin user ID
        name: 'Admin User',
        role: 'admin'
      }
    };
  }

  /**
   * Verify JWT token and return payload
   */
  async verifyToken(token: string): Promise<TokenPayload | null> {
    try {
      // Check if token is blacklisted
      if (this.tokenBlacklist.has(token)) {
        return null;
      }

      // Verify token signature and expiration
      const payload = jwt.verify(token, this.jwtSecret) as TokenPayload;
      return payload;
    } catch (error) {
      // Token is invalid, expired, or malformed
      return null;
    }
  }

  /**
   * Logout by adding token to blacklist
   */
  async logout(token: string): Promise<void> {
    // Add token to blacklist to prevent reuse
    this.tokenBlacklist.add(token);
  }

  /**
   * Check if token is valid (not blacklisted and properly signed)
   */
  async isTokenValid(token: string): Promise<boolean> {
    const payload = await this.verifyToken(token);
    return payload !== null;
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Get current admin credentials (for testing purposes)
   */
  getAdminCredentials(): { username: string; password: string } {
    return {
      username: this.adminUsername,
      password: this.adminPassword
    };
  }

  /**
   * Clear token blacklist (for testing purposes)
   */
  clearBlacklist(): void {
    this.tokenBlacklist.clear();
  }
}
