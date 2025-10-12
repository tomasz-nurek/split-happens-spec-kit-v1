import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, Signal, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from './api.service';
import { ErrorService } from './error.service';
import { AuthLoginResponse, AuthVerifyResponse, User } from '../types/api';

interface AuthState {
  token: string | null;
  user: User | null;
  status: 'initializing' | 'idle' | 'authenticating' | 'authenticated' | 'error';
  lastVerifiedAt: string | null;
}

interface VerifyOptions {
  silent?: boolean;
}

const TOKEN_STORAGE_KEY = 'split-happens.auth.token';
const REFRESH_BUFFER_MS = 60_000; // refresh one minute before expiry
const MIN_REFRESH_INTERVAL_MS = 60_000; // never poll faster than once per minute
const DEFAULT_REFRESH_INTERVAL_MS = 15 * 60_000; // fallback: refresh every 15 minutes

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly errorService = inject(ErrorService);

  private readonly state = signal<AuthState>({
    token: null,
    user: null,
    status: 'initializing',
    lastVerifiedAt: null
  });

  private readonly authError = signal<string | null>(null);
  private readonly isVerifying = signal(false);
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingVerification: Promise<boolean> | null = null;
  private refreshRetryCount = 0;
  private readonly maxRefreshRetries = 3;

  readonly authState: Signal<AuthState> = this.state.asReadonly();
  readonly user: Signal<User | null> = computed(() => this.state().user);
  readonly token: Signal<string | null> = computed(() => this.state().token);
  readonly isAuthenticated: Signal<boolean> = computed(() => {
    const snapshot = this.state();
    return snapshot.status === 'authenticated' && !!snapshot.token && !!snapshot.user;
  });
  readonly isInitializing: Signal<boolean> = computed(() => this.state().status === 'initializing');
  readonly isBusy: Signal<boolean> = computed(() => {
    const snapshot = this.state();
    return snapshot.status === 'authenticating' || this.isVerifying();
  });
  readonly errorSignal: Signal<string | null> = this.authError.asReadonly();

  constructor() {
    effect(() => {
      const token = this.state().token;
      if (token) {
        this.scheduleRefresh(token);
      } else {
        this.clearRefreshTimer();
      }
    });

    this.restoreSession();
  }

  async login(username: string, password: string): Promise<boolean> {
    this.setError(null);
    this.setStatus('authenticating');

    try {
      const response = await firstValueFrom(
        this.api.post<AuthLoginResponse>('/auth/login', { username, password })
      );
      this.persistToken(response.token);
      this.setState({
        token: response.token,
        user: response.user,
        status: 'authenticated',
        lastVerifiedAt: new Date().toISOString()
      });
      this.errorService.clearError();
      return true;
    } catch (error) {
      const message = this.extractErrorMessage(error) ?? 'Unable to sign in. Please try again.';
      this.setError(message);
      this.errorService.reportError({ message, details: error });
      this.clearSession('error');
      return false;
    }
  }

  async logout(): Promise<void> {
    const token = this.state().token;
    this.clearRefreshTimer();

    if (token) {
      try {
        await firstValueFrom(
          this.api.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${token}` } })
        );
      } catch (error) {
        // Logout failures should not prevent clearing local session.
        this.errorService.reportError({
          message: 'Failed to notify server about logout. Session cleared locally.',
          details: error
        });
      }
    }

  this.clearSession('idle');
  }

  async ensureAuthenticated(): Promise<boolean> {
    if (this.isAuthenticated()) {
      return true;
    }

    return this.verifyCurrentSession({ silent: true });
  }

  async verifyCurrentSession(options: VerifyOptions = {}): Promise<boolean> {
    const token = this.state().token ?? this.readToken();

    if (!token) {
      if (!options.silent) {
        this.setError('You are not signed in.');
      }
      this.clearSession();
      return false;
    }

    // Request deduplication: reuse pending verification if one is in progress
    if (this.pendingVerification) {
      return this.pendingVerification;
    }

    return this.verifyToken(token, options);
  }

  private async verifyToken(token: string, options: VerifyOptions = {}): Promise<boolean> {
    const { silent = false } = options;
    
    // Request deduplication: cache the pending promise
    if (this.pendingVerification) {
      return this.pendingVerification;
    }

    this.isVerifying.set(true);
    if (!silent) {
      this.setStatus('authenticating');
    }

    const verificationPromise = (async () => {
      try {
        const response = await firstValueFrom(
          this.api.get<AuthVerifyResponse>('/auth/verify', {
            headers: { Authorization: `Bearer ${token}` }
          })
        );

        if (!response.valid) {
          throw new Error('Token is not valid');
        }

        this.persistToken(token);
        this.setState({
          token,
          user: response.user,
          status: 'authenticated',
          lastVerifiedAt: new Date().toISOString()
        });
        this.setError(null);
        this.refreshRetryCount = 0; // Reset retry count on success
        return true;
      } catch (error) {
        const message = this.extractErrorMessage(error) ?? 'Session expired. Please sign in again.';
        this.setError(silent ? null : message);
        if (!silent) {
          this.errorService.reportError({ message, details: error });
        }
        this.clearSession('idle');
        return false;
      } finally {
        this.isVerifying.set(false);
        this.pendingVerification = null;
      }
    })();

    this.pendingVerification = verificationPromise;
    return verificationPromise;
  }

  private restoreSession(): void {
    const token = this.readToken();
    if (!token) {
      // No token found, initialization complete with idle state
      this.setStatus('idle');
      return;
    }

    this.setState({ token });
    // Verify token in background, will update status when complete
    void this.verifyToken(token, { silent: true }).finally(() => {
      // Ensure we're not stuck in initializing state
      if (this.state().status === 'initializing') {
        this.setStatus('idle');
      }
    });
  }

  private setState(patch: Partial<AuthState>): void {
    this.state.update((current) => ({ ...current, ...patch }));
  }

  private setStatus(status: AuthState['status']): void {
    this.setState({ status });
  }

  private setError(message: string | null): void {
    this.authError.set(message);
  }

  private persistToken(token: string): void {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch (error) {
      console.warn('Unable to persist auth token', error);
    }
  }

  private readToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch (error) {
      console.warn('Unable to read auth token', error);
      return null;
    }
  }

  private clearToken(): void {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch (error) {
      console.warn('Unable to clear auth token', error);
    }
  }

  private extractErrorMessage(error: unknown): string | null {
    if (error instanceof HttpErrorResponse) {
      if (typeof error.error === 'string') {
        return error.error;
      }

      if (error.error && typeof error.error === 'object' && 'error' in error.error) {
        const candidate = (error.error as Record<string, unknown>)['error'];
        return typeof candidate === 'string' ? candidate : null;
      }

      if (error.message) {
        return error.message;
      }

      return null;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return null;
  }

  private clearSession(status: AuthState['status'] = 'idle'): void {
    this.clearRefreshTimer();
    this.clearToken();
    this.setState({
      token: null,
      user: null,
      status,
      lastVerifiedAt: null
    });
  }

  private scheduleRefresh(token: string): void {
    this.clearRefreshTimer();

    const delay = this.computeRefreshDelay(token);
    this.refreshTimer = setTimeout(() => {
      void this.refreshWithRetry(token);
    }, delay);
  }

  private async refreshWithRetry(token: string): Promise<void> {
    const success = await this.verifyToken(token, { silent: true });
    
    if (!success && this.refreshRetryCount < this.maxRefreshRetries) {
      // Retry with exponential backoff
      this.refreshRetryCount++;
      const backoffDelay = Math.min(1000 * Math.pow(2, this.refreshRetryCount - 1), 30000);
      
      console.warn(`Token refresh failed, retrying in ${backoffDelay}ms (attempt ${this.refreshRetryCount}/${this.maxRefreshRetries})`);
      
      this.refreshTimer = setTimeout(() => {
        void this.refreshWithRetry(token);
      }, backoffDelay);
    } else if (!success) {
      // Max retries reached, give up
      console.warn('Token refresh failed after maximum retries');
      this.refreshRetryCount = 0;
    }
  }

  private computeRefreshDelay(token: string): number {
    const expiresInMs = this.getTokenExpiresInMs(token);

    if (expiresInMs === null) {
      return DEFAULT_REFRESH_INTERVAL_MS;
    }

    const refreshIn = expiresInMs - REFRESH_BUFFER_MS;
    if (refreshIn <= 0) {
      return MIN_REFRESH_INTERVAL_MS;
    }

    return Math.max(refreshIn, MIN_REFRESH_INTERVAL_MS);
  }

  /**
   * Extract token expiration from JWT payload.
   * 
   * SECURITY NOTE: This is for UX optimization only (scheduling refresh before expiry).
   * The backend /auth/verify endpoint is the SINGLE SOURCE OF TRUTH for token validity.
   * Client-side JWT parsing does NOT verify the signature and should NEVER be used
   * for security decisions. An attacker can craft a malicious JWT with any expiration.
   * 
   * @param token JWT token string
   * @returns Milliseconds until token expires, or null if unable to parse
   */
  private getTokenExpiresInMs(token: string): number | null {
    try {
      const payloadSegment = token.split('.')[1];
      if (!payloadSegment) {
        return null;
      }

      const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
      const decoded = this.decodeBase64(padded);
      const payload = JSON.parse(decoded) as { exp?: number };

      if (!payload.exp) {
        return null;
      }

      const expiresAt = payload.exp * 1000;
      return expiresAt - Date.now();
    } catch (error) {
      console.warn('Unable to read token expiration', error);
      return null;
    }
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Decode base64 string to UTF-8.
   * Uses browser's atob when available.
   * 
   * @param value Base64-encoded string
   * @returns Decoded UTF-8 string
   */
  private decodeBase64(value: string): string {
    const globalScope = globalThis as typeof globalThis & {
      atob?(data: string): string;
    };

    if (typeof globalScope.atob === 'function') {
      return globalScope.atob(value);
    }

    throw new Error('atob is not available in this environment for base64 decoding.');
  }
}
