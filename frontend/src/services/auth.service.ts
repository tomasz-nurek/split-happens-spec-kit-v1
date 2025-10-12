import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, Signal, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from './api.service';
import { ErrorService } from './error.service';
import { AuthLoginResponse, AuthVerifyResponse, User } from '../types/api';

interface AuthState {
  token: string | null;
  user: User | null;
  status: 'idle' | 'authenticating' | 'authenticated' | 'error';
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
    status: 'idle',
    lastVerifiedAt: null
  });

  private readonly authError = signal<string | null>(null);
  private readonly isVerifying = signal(false);
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  readonly authState: Signal<AuthState> = this.state.asReadonly();
  readonly user: Signal<User | null> = computed(() => this.state().user);
  readonly token: Signal<string | null> = computed(() => this.state().token);
  readonly isAuthenticated: Signal<boolean> = computed(() => {
    const snapshot = this.state();
    return snapshot.status === 'authenticated' && !!snapshot.token && !!snapshot.user;
  });
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
    }, { allowSignalWrites: true });

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

    return this.verifyToken(token, options);
  }

  private async verifyToken(token: string, options: VerifyOptions = {}): Promise<boolean> {
    const { silent = false } = options;
    this.isVerifying.set(true);
    if (!silent) {
      this.setStatus('authenticating');
    }

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
    }
  }

  private restoreSession(): void {
    const token = this.readToken();
    if (!token) {
      return;
    }

    this.setState({ token });
    void this.verifyToken(token, { silent: true });
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
      void this.verifyToken(token, { silent: true });
    }, delay);
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

  private decodeBase64(value: string): string {
    const globalScope = globalThis as typeof globalThis & {
      Buffer?: {
        from(input: string, encoding: string): { toString(encoding: string): string };
      };
      atob?(data: string): string;
    };

    if (typeof globalScope.atob === 'function') {
      return globalScope.atob(value);
    }

    const bufferFactory = globalScope.Buffer;
    if (bufferFactory) {
      return bufferFactory.from(value, 'base64').toString('utf-8');
    }

    throw new Error('Neither atob nor Buffer are available to decode base64 strings.');
  }
}
