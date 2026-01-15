/**
 * Built-in Interceptors
 * middleware but cooler.
 */

import {
    type Interceptor,
    type CallHandler,
    type ExecutionContextWrapper,
    Injectable,
} from '@flareone/core';

export interface LoggingInterceptorOptions {
    level?: 'debug' | 'info' | 'warn' | 'error';
    includeBody?: boolean;
    includeResponse?: boolean;
    logger?: (message: string, data?: Record<string, unknown>) => void;
}

/**
 * Logging interceptor for request/response logging
 */
@Injectable()
export class LoggingInterceptor implements Interceptor {
    constructor(private readonly options: LoggingInterceptorOptions = {}) { }

    async intercept(
        context: ExecutionContextWrapper,
        next: CallHandler
    ): Promise<unknown> {
        const request = context.getRequest();
        const startTime = Date.now();
        const requestId = crypto.randomUUID();

        const logData: Record<string, unknown> = {
            requestId,
            method: request.method,
            url: request.url,
            ip: context.getClientIp(),
            userAgent: request.headers.get('user-agent'),
        };

        this.log(`Incoming request`, logData);

        try {
            const result = await next.handle();
            const duration = Date.now() - startTime;

            this.log(`Request completed`, {
                ...logData,
                duration: `${duration}ms`,
                success: true,
            });

            return result;
        } catch (error) {
            const duration = Date.now() - startTime;

            this.log(`Request failed`, {
                ...logData,
                duration: `${duration}ms`,
                success: false,
                error: error instanceof Error ? error.message : String(error),
            });

            throw error;
        }
    }

    private log(message: string, data?: Record<string, unknown>): void {
        if (this.options.logger) {
            this.options.logger(message, data);
        } else {
            console.log(JSON.stringify({ message, ...data }));
        }
    }
}

export interface TimeoutInterceptorOptions {
    timeout: number;
    message?: string;
}

/**
 * Timeout interceptor
 */
@Injectable()
export class TimeoutInterceptor implements Interceptor {
    constructor(private readonly options: TimeoutInterceptorOptions) { }

    async intercept(
        _context: ExecutionContextWrapper,
        next: CallHandler
    ): Promise<unknown> {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(this.options.message ?? 'Request timeout'));
            }, this.options.timeout);
        });

        return Promise.race([next.handle(), timeoutPromise]);
    }
}

export interface CacheInterceptorOptions {
    ttl?: number;
    keyGenerator?: (context: ExecutionContextWrapper) => string;
    methods?: string[];
}

/**
 * In-memory cache interceptor
 * For production, use KV or other distributed cache
 */
@Injectable()
export class CacheInterceptor implements Interceptor {
    private readonly cache = new Map<string, { data: unknown; expiresAt: number }>();
    private readonly ttl: number;
    private readonly methods: string[];

    constructor(options: CacheInterceptorOptions = {}) {
        this.ttl = (options.ttl ?? 60) * 1000;
        this.methods = options.methods ?? ['GET'];
    }

    async intercept(
        context: ExecutionContextWrapper,
        next: CallHandler
    ): Promise<unknown> {
        const request = context.getRequest();

        if (!this.methods.includes(request.method)) {
            return next.handle();
        }

        const key = this.generateKey(context);
        const now = Date.now();

        const cached = this.cache.get(key);
        if (cached && cached.expiresAt > now) {
            return cached.data;
        }
        const result = await next.handle();

        this.cache.set(key, {
            data: result,
            expiresAt: now + this.ttl,
        });

        return result;
    }

    private generateKey(context: ExecutionContextWrapper): string {
        const request = context.getRequest();
        return `cache:${request.method}:${request.url}`;
    }

    /**
     * Clear the cache
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Invalidate a specific key
     */
    invalidate(key: string): void {
        this.cache.delete(key);
    }
}

export interface TransformInterceptorOptions<T, R> {
    transform: (data: T) => R | Promise<R>;
}

/**
 * Generic transform interceptor
 */
export class TransformInterceptor<T = unknown, R = unknown> implements Interceptor {
    constructor(
        private readonly transformer: (data: T) => R | Promise<R>
    ) { }

    async intercept(
        _context: ExecutionContextWrapper,
        next: CallHandler<T>
    ): Promise<R> {
        const result = await next.handle();
        return this.transformer(result);
    }
}

export interface ResponseWrapperOptions {
    dataKey?: string;
    includeMetadata?: boolean;
}

/**
 * Wrap response in standard format
 */
@Injectable()
export class ResponseWrapperInterceptor implements Interceptor {
    constructor(private readonly options: ResponseWrapperOptions = {}) { }

    async intercept(
        context: ExecutionContextWrapper,
        next: CallHandler
    ): Promise<unknown> {
        const result = await next.handle();
        const dataKey = this.options.dataKey ?? 'data';

        const wrapped: Record<string, unknown> = {
            success: true,
            [dataKey]: result,
        };

        if (this.options.includeMetadata) {
            wrapped['metadata'] = {
                timestamp: new Date().toISOString(),
                path: context.getUrl().pathname,
            };
        }

        return wrapped;
    }
}

/**
 * Remove null and undefined values from response
 */
@Injectable()
export class ExcludeNullInterceptor implements Interceptor {
    async intercept(
        _context: ExecutionContextWrapper,
        next: CallHandler
    ): Promise<unknown> {
        const result = await next.handle();
        return this.removeNulls(result);
    }

    private removeNulls(obj: unknown): unknown {
        if (obj === null || obj === undefined) {
            return undefined;
        }

        if (Array.isArray(obj)) {
            return obj.map((item) => this.removeNulls(item)).filter((item) => item !== undefined);
        }

        if (typeof obj === 'object') {
            const cleaned: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(obj)) {
                const cleanedValue = this.removeNulls(value);
                if (cleanedValue !== undefined) {
                    cleaned[key] = cleanedValue;
                }
            }
            return cleaned;
        }

        return obj;
    }
}

/**
 * Serialize class instances to plain objects
 */
@Injectable()
export class ClassSerializerInterceptor implements Interceptor {
    async intercept(
        _context: ExecutionContextWrapper,
        next: CallHandler
    ): Promise<unknown> {
        const result = await next.handle();
        return this.serialize(result);
    }

    private serialize(data: unknown): unknown {
        if (data === null || data === undefined) {
            return data;
        }

        if (Array.isArray(data)) {
            return data.map((item) => this.serialize(item));
        }

        if (data instanceof Date) {
            return data.toISOString();
        }

        if (typeof data === 'object') {
            if ('toJSON' in data && typeof (data as { toJSON: () => unknown }).toJSON === 'function') {
                return (data as { toJSON: () => unknown }).toJSON();
            }

            const serialized: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(data)) {
                if (!key.startsWith('_')) {
                    serialized[key] = this.serialize(value);
                }
            }
            return serialized;
        }

        return data;
    }
}

/**
 * KV-based cache interceptor for distributed caching
 */
export interface KVCacheOptions {
    kv: KVNamespace;
    ttl?: number;
    keyGenerator?: (context: ExecutionContextWrapper) => string;
    methods?: string[];
    keyPrefix?: string;
}

@Injectable()
export class KVCacheInterceptor implements Interceptor {
    private readonly ttl: number;
    private readonly methods: string[];
    private readonly keyPrefix: string;

    constructor(private readonly options: KVCacheOptions) {
        this.ttl = options.ttl ?? 60;
        this.methods = options.methods ?? ['GET'];
        this.keyPrefix = options.keyPrefix ?? 'cache:';
    }

    async intercept(
        context: ExecutionContextWrapper,
        next: CallHandler
    ): Promise<unknown> {
        const request = context.getRequest();

        if (!this.methods.includes(request.method)) {
            return next.handle();
        }

        const key = this.options.keyGenerator
            ? this.options.keyGenerator(context)
            : this.generateKey(context);

        const fullKey = `${this.keyPrefix}${key}`;

        const cached = await this.options.kv.get(fullKey, 'json');
        if (cached !== null) {
            return cached;
        }

        const result = await next.handle();

        await this.options.kv.put(fullKey, JSON.stringify(result), {
            expirationTtl: this.ttl,
        });

        return result;
    }

    private generateKey(context: ExecutionContextWrapper): string {
        const request = context.getRequest();
        return `${request.method}:${request.url}`;
    }

    /**
     * Invalidate cache by key
     */
    async invalidate(key: string): Promise<void> {
        await this.options.kv.delete(`${this.keyPrefix}${key}`);
    }

    /**
     * Invalidate cache by prefix
     */
    async invalidateByPrefix(prefix: string): Promise<void> {
        const fullPrefix = `${this.keyPrefix}${prefix}`;
        const keys = await this.options.kv.list({ prefix: fullPrefix });

        await Promise.all(
            keys.keys.map(k => this.options.kv.delete(k.name))
        );
    }
}

/**
 * Durable Object-based cache interceptor for advanced caching
 */
export interface DOCacheOptions {
    namespace: DurableObjectNamespace;
    ttl?: number;
    keyGenerator?: (context: ExecutionContextWrapper) => string;
    methods?: string[];
    shardKeyGenerator?: (context: ExecutionContextWrapper) => string;
}

@Injectable()
export class DOCacheInterceptor implements Interceptor {
    private readonly ttl: number;
    private readonly methods: string[];

    constructor(private readonly options: DOCacheOptions) {
        this.ttl = options.ttl ?? 60;
        this.methods = options.methods ?? ['GET'];
    }

    async intercept(
        context: ExecutionContextWrapper,
        next: CallHandler
    ): Promise<unknown> {
        const request = context.getRequest();

        if (!this.methods.includes(request.method)) {
            return next.handle();
        }

        const shardKey = this.options.shardKeyGenerator
            ? this.options.shardKeyGenerator(context)
            : 'cache';

        const id = this.options.namespace.idFromName(shardKey);
        const stub = this.options.namespace.get(id);

        const cacheKey = this.options.keyGenerator
            ? this.options.keyGenerator(context)
            : this.generateKey(context);

        const response = await stub.fetch('https://cache/get', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: cacheKey }),
        });

        if (response.ok) {
            return response.json();
        }

        const result = await next.handle();

        await stub.fetch('https://cache/set', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                key: cacheKey,
                value: result,
                ttl: this.ttl,
            }),
        });

        return result;
    }

    private generateKey(context: ExecutionContextWrapper): string {
        const request = context.getRequest();
        return `${request.method}:${request.url}`;
    }

    /**
     * Invalidate cache
     */
    async invalidate(key: string, shardKey: string = 'cache'): Promise<void> {
        const id = this.options.namespace.idFromName(shardKey);
        const stub = this.options.namespace.get(id);

        await stub.fetch('https://cache/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key }),
        });
    }

    /**
     * Clear all cache in a shard
     */
    async clear(shardKey: string = 'cache'): Promise<void> {
        const id = this.options.namespace.idFromName(shardKey);
        const stub = this.options.namespace.get(id);

        await stub.fetch('https://cache/clear', {
            method: 'POST',
        });
    }
}
