import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../environments/environment';

type PrimitiveParam = string | number | boolean;

export interface RequestOptions {
  params?: HttpParams | Record<string, PrimitiveParam>;
  headers?: HttpHeaders | Record<string, string>;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/?$/, '');

  get<T>(path: string, options?: RequestOptions): Observable<T> {
    return this.http.get<T>(this.buildUrl(path), this.normalizeOptions(options));
  }

  post<T>(path: string, body: unknown, options?: RequestOptions): Observable<T> {
    return this.http.post<T>(this.buildUrl(path), body, this.normalizeOptions(options));
  }

  delete<T>(path: string, options?: RequestOptions): Observable<T> {
    return this.http.delete<T>(this.buildUrl(path), this.normalizeOptions(options));
  }

  patch<T>(path: string, body: unknown, options?: RequestOptions): Observable<T> {
    return this.http.patch<T>(this.buildUrl(path), body, this.normalizeOptions(options));
  }

  private buildUrl(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${normalizedPath}`;
  }

  private normalizeOptions(options?: RequestOptions) {
    if (!options) {
      return {};
    }

    const normalizedParams = options.params instanceof HttpParams
      ? options.params
      : new HttpParams({ fromObject: this.toStringRecord(options.params ?? {}) });

    const normalizedHeaders = options.headers instanceof HttpHeaders
      ? options.headers
      : new HttpHeaders(options.headers ?? {});

    return {
      params: normalizedParams,
      headers: normalizedHeaders
    };
  }

  private toStringRecord(params: Record<string, PrimitiveParam>): Record<string, string> {
    return Object.entries(params).reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = String(value);
      return acc;
    }, {});
  }
}
