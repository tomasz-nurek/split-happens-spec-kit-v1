/**
 * Simple structured logger with severity levels and correlation IDs.
 * Avoids leaking sensitive details; emits JSON lines suitable for ingest.
 */
export type LogSeverity = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export interface LogContext {
  correlationId?: string;
  method?: string;
  url?: string;
  ip?: string;
  // Intentionally avoid user-agent to reduce PII exposure
  statusCode?: number;
  [key: string]: unknown;
}

function nowIso(): string {
  return new Date().toISOString();
}

function emit(severity: LogSeverity, message: string, ctx?: LogContext, err?: unknown) {
  const base: Record<string, unknown> = {
    ts: nowIso(),
    severity,
    message,
    ...ctx,
  };

  if (err instanceof Error) {
    base.error = {
      name: err.name,
      message: err.message,
      // Always include stack in logs for debugging, do not send to clients
      stack: err.stack,
    };
  }

  const line = JSON.stringify(base);
  // Route by severity
  if (severity === 'ERROR' || severity === 'FATAL') {
    console.error(line);
  } else if (severity === 'WARN') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, ctx?: LogContext) => emit('DEBUG', message, ctx),
  info: (message: string, ctx?: LogContext) => emit('INFO', message, ctx),
  warn: (message: string, ctx?: LogContext) => emit('WARN', message, ctx),
  error: (message: string, err?: unknown, ctx?: LogContext) => emit('ERROR', message, ctx, err),
  fatal: (message: string, err?: unknown, ctx?: LogContext) => emit('FATAL', message, ctx, err),
};

/**
 * Generate a short correlation id.
 */
export function genCorrelationId(): string {
  // 12-char base36 timestamp+rand, sufficient for correlation tracing
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `${t}${r}`.slice(0, 12);
}
