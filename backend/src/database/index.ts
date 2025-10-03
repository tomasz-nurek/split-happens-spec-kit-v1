import knex, { Knex } from 'knex';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { DatabaseError } from '../middleware/error';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const knexConfig = require('../../knexfile.js');

type EnvName = 'development' | 'test' | 'production';

let db: Knex | null = null;
let initialized = false;
let initPromise: Promise<void> | null = null;

function resolveEnv(): EnvName {
    const rawEnv = process.env.NODE_ENV as EnvName | undefined;
	if (rawEnv === 'test') return 'test';
	if (rawEnv === 'development' || rawEnv === 'production') return rawEnv;
	// Detect Vitest context
	if (process.env.VITEST || process.env.VITEST_WORKER_ID) return 'test';
	// Fallback
	return 'development';
}

function ensureSqliteFileIfNeeded(config: Knex.Config) {
	// For SQLite, ensure the database file exists before connecting
	if (config && (config.client === 'sqlite3' || config.client === 'better-sqlite3')) {
		const filename = config.connection?.filename as string | undefined;
		if (filename) {
			const dir = path.dirname(filename);
			try {
				if (!fs.existsSync(dir)) {
					fs.mkdirSync(dir, { recursive: true });
				}
				if (!fs.existsSync(filename)) {
					// touch the file
					fs.closeSync(fs.openSync(filename, 'w'));
					logger.info('Created SQLite database file', { filename });
				}
			} catch (err) {
				logger.error('Failed to prepare SQLite database file', err as Error, { filename });
				throw new DatabaseError('Failed to prepare SQLite database file', err as Error);
			}
		}
	}
}

/**
 * Initialize the database connection and run migrations (skips in test env).
 * Ensures a singleton knex instance is configured and ready.
 */
export async function initDatabase(): Promise<void> {
	if (initialized) return;
	if (initPromise) return initPromise;

	const env = resolveEnv();
	const config = knexConfig[env];
	if (!config) {
		throw new DatabaseError(`Knex configuration missing for env: ${env}`);
	}

	ensureSqliteFileIfNeeded(config);

	db = knex(config);

	logger.info('Database initializing', { env, client: config.client });

	initPromise = (async () => {
		try {
			// Run latest migrations automatically except in test (tests manage their own)
			if (env !== 'test') {
				await db!.migrate.latest();
				logger.info('Database migrations applied');
			}

			// Simple connectivity check
			await healthCheck(true);

			initialized = true;
			logger.info('Database initialized');
		} catch (err) {
			logger.error('Database initialization failed', err as Error);
			await internalReset();
			throw new DatabaseError('Database initialization failed', err as Error);
		}
	})();

	return initPromise;
}

/**
 * Health check for database connectivity.
 * If throwOnFail is true, throws DatabaseError on failure; otherwise returns { ok, error? }.
 */
export async function healthCheck(throwOnFail = false): Promise<{ ok: true } | { ok: false; error: string }> {
	try {
		// Ensure knex is created; do not auto-init here to avoid implicit migrations in tests
		if (!db) {
			const env = resolveEnv();
			const config = knexConfig[env];
			ensureSqliteFileIfNeeded(config);
			db = knex(config);
		}
		// For SQLite, a simple select 1 works
		await db!.raw('select 1 as ok');
		return { ok: true } as const;
	} catch (err: unknown) {
		if (throwOnFail) {
			throw new DatabaseError('Database health check failed', err as Error);
		}
		let errorMessage = 'unknown error';
		if (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string') {
			errorMessage = (err as { message: string }).message;
		}
		return { ok: false, error: errorMessage } as const;
	}
}

/**
 * Get the configured knex instance. Call initDatabase() during app startup in non-test envs.
 */
export function getDb(): Knex {
	if (!db) {
		const env = resolveEnv();
		const config = knexConfig[env];
		ensureSqliteFileIfNeeded(config);
		// Do not mark initialized here; this is a lazy accessor (tests may manage migrations)
		db = knex(config);
	}
	return db;
}

/**
 * Internal reset helper – destroys current connection (if any) and clears flags.
 * Always swallow destroy errors to avoid masking original problems.
 */
async function internalReset() {
	try {
		if (db) await db.destroy();
	} catch (_) {
		// ignore
	}
	db = null;
	initialized = false;
	initPromise = null;
}

/**
 * Public helper to explicitly close and reset the database layer.
 * Use in test teardown or graceful shutdown. Subsequent initDatabase() calls
 * will perform a fresh initialization.
 */
export async function closeDatabase(): Promise<void> {
	await internalReset();
}

// Backwards-compatible default export kept as a function (NOT the instance) to avoid frozen destroyed connection.
export default getDb;