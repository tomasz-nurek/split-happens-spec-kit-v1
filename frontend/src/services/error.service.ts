import { Injectable, Signal, computed, signal } from '@angular/core';

import { ApplicationError } from '../types/api';

@Injectable({ providedIn: 'root' })
export class ErrorService {
  private readonly lastError = signal<ApplicationError | null>(null);
  private readonly errorComputed = computed(() => this.lastError());

  error(): ApplicationError | null {
    return this.lastError();
  }

  errorSignal(): Signal<ApplicationError | null> {
    return this.errorComputed;
  }

  clearError(): void {
    this.lastError.set(null);
  }

  reportError(error: ApplicationError | string): void {
    if (typeof error === 'string') {
      this.lastError.set({ message: error, timestamp: new Date().toISOString() });
      return;
    }

    this.lastError.set({ ...error, timestamp: error.timestamp ?? new Date().toISOString() });
  }
}
