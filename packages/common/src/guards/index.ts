/**
 * Built-in Guards
 * authentication and other security stuff.
 */

import {
    type Guard,
    type ExecutionContextWrapper,
    Injectable,
    UnauthorizedException,
    ForbiddenException,
    defineMethodMetadata,
    getMethodMetadata,
} from '@flareone/core';

/**
 * Base authentication guard
 * Override canActivate to implement custom logic
 */
@Injectable()
export class AuthGuard implements Guard {
    async canActivate(context: ExecutionContextWrapper): Promise<boolean> {
        const isPublic = context.getMetadata<boolean>('isPublic');
        if (isPublic) {
            return true;
        }

        const request = context.getRequest();
        const authHeader = request.headers.get('authorization');

        if (!authHeader) {
            throw new UnauthorizedException('Missing authorization header');
        }

        return this.validateToken(authHeader, context);
    }

    /**
     * Override this method to implement token validation
     */
    protected async validateToken(
        _authHeader: string,
        _context: ExecutionContextWrapper
    ): Promise<boolean> {
        return true;
    }
}

export interface JwtGuardOptions {
    secret?: string;
    secretKey?: CryptoKey;
    tokenPrefix?: string;
}

/**
 * JWT authentication guard
 */
@Injectable()
export class JwtGuard extends AuthGuard {
    constructor(private readonly options: JwtGuardOptions = {}) {
        super();
    }

    protected async validateToken(
        authHeader: string,
        context: ExecutionContextWrapper
    ): Promise<boolean> {
        const prefix = this.options.tokenPrefix ?? 'Bearer';

        if (!authHeader.startsWith(`${prefix} `)) {
            throw new UnauthorizedException('Invalid authorization format');
        }

        const token = authHeader.slice(prefix.length + 1);

        try {
            const payload = await this.verifyJwt(token);
            context.setData('user', payload);
            return true;
        } catch {
            throw new UnauthorizedException('Invalid or expired token');
        }
    }

    private async verifyJwt(token: string): Promise<Record<string, unknown>> {
        const [headerB64, payloadB64, signatureB64] = token.split('.');

        if (!headerB64 || !payloadB64 || !signatureB64) {
            throw new Error('Invalid token format');
        }

        const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

        if (payload.exp && Date.now() >= payload.exp * 1000) {
            throw new Error('Token expired');
        }

        if (this.options.secret || this.options.secretKey) {
            const isValid = await this.verifySignature(
                `${headerB64}.${payloadB64}`,
                signatureB64
            );

            if (!isValid) {
                throw new Error('Invalid signature');
            }
        }

        return payload;
    }

    private async verifySignature(data: string, signature: string): Promise<boolean> {
        const encoder = new TextEncoder();

        let key: CryptoKey;

        if (this.options.secretKey) {
            key = this.options.secretKey;
        } else if (this.options.secret) {
            key = await crypto.subtle.importKey(
                'raw',
                encoder.encode(this.options.secret),
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['verify']
            );
        } else {
            return true;
        }

        const signatureBytes = Uint8Array.from(
            atob(signature.replace(/-/g, '+').replace(/_/g, '/')),
            (c) => c.charCodeAt(0)
        );

        return crypto.subtle.verify(
            'HMAC',
            key,
            signatureBytes,
            encoder.encode(data)
        );
    }
}

export interface ApiKeyGuardOptions {
    headerName?: string;
    queryParam?: string;
    validKeys?: string[];
}

/**
 * API Key authentication guard
 */
@Injectable()
export class ApiKeyGuard implements Guard {
    constructor(private readonly options: ApiKeyGuardOptions = {}) { }

    async canActivate(context: ExecutionContextWrapper): Promise<boolean> {
        const isPublic = context.getMetadata<boolean>('isPublic');
        if (isPublic) {
            return true;
        }

        const apiKey = this.extractApiKey(context);

        if (!apiKey) {
            throw new UnauthorizedException('API key is required');
        }

        const isValid = await this.validateKey(apiKey, context);

        if (!isValid) {
            throw new UnauthorizedException('Invalid API key');
        }

        return true;
    }

    protected extractApiKey(context: ExecutionContextWrapper): string | null {
        const request = context.getRequest();

        const headerName = this.options.headerName ?? 'x-api-key';
        const headerKey = request.headers.get(headerName);
        if (headerKey) return headerKey;
        if (this.options.queryParam) {
            const queryKey = context.getQueryParam(this.options.queryParam);
            if (queryKey) return queryKey;
        }

        return null;
    }

    protected async validateKey(
        apiKey: string,
        _context: ExecutionContextWrapper
    ): Promise<boolean> {
        if (this.options.validKeys) {
            return this.options.validKeys.includes(apiKey);
        }
        return true;
    }
}

/**
 * Role-based access control guard
 */
@Injectable()
export class RolesGuard implements Guard {
    async canActivate(context: ExecutionContextWrapper): Promise<boolean> {
        const requiredRoles = context.getMetadata<string[]>('roles');

        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const user = context.getData<{ roles?: string[] }>('user');

        if (!user || !user.roles) {
            throw new ForbiddenException('Access denied');
        }

        const hasRole = requiredRoles.some((role: string) => user.roles!.includes(role));

        if (!hasRole) {
            throw new ForbiddenException('Insufficient permissions');
        }

        return true;
    }
}

export interface ThrottleGuardOptions {
    limit?: number;
    ttl?: number;
    keyGenerator?: (context: ExecutionContextWrapper) => string;
}

/**
 * Rate limiting guard with automatic cleanup
 * Uses in-memory storage with periodic cleanup of expired entries.
 * For production distributed rate limiting, use KV or Durable Objects.
 */
@Injectable()
export class ThrottleGuard implements Guard {
    private readonly storage = new Map<string, { count: number; expiresAt: number }>();
    private readonly limit: number;
    private readonly ttl: number;
    private cleanupInterval?: ReturnType<typeof setInterval>;

    constructor(options: ThrottleGuardOptions = {}) {
        this.limit = options.limit ?? 100;
        this.ttl = options.ttl ?? 60;
        this.startCleanup();
    }

    private startCleanup(): void {
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [key, value] of this.storage.entries()) {
                if (value.expiresAt < now) {
                    this.storage.delete(key);
                }
            }
        }, 60000);
    }

    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }

    async canActivate(context: ExecutionContextWrapper): Promise<boolean> {
        const skipThrottle = context.getMetadata<boolean>('skipThrottle');
        if (skipThrottle) {
            return true;
        }
        const throttleConfig = context.getMetadata<{ limit: number; ttl: number }>('throttle');
        const limit = throttleConfig?.limit ?? this.limit;
        const ttl = throttleConfig?.ttl ?? this.ttl;

        const key = this.generateKey(context);
        const now = Date.now();

        const entry = this.storage.get(key);

        if (entry && entry.expiresAt > now) {
            if (entry.count >= limit) {
                const response = new Response(JSON.stringify({
                    statusCode: 429,
                    message: 'Too Many Requests',
                }), {
                    status: 429,
                    headers: {
                        'Content-Type': 'application/json',
                        'Retry-After': String(Math.ceil((entry.expiresAt - now) / 1000)),
                        'X-RateLimit-Limit': String(limit),
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': String(Math.ceil(entry.expiresAt / 1000)),
                    },
                });
                throw response;
            }

            entry.count++;
        } else {
            this.storage.set(key, {
                count: 1,
                expiresAt: now + ttl * 1000,
            });
        }

        return true;
    }

    private generateKey(context: ExecutionContextWrapper): string {
        const ip = context.getClientIp() ?? 'unknown';
        const path = context.getUrl().pathname;
        return `throttle:${ip}:${path}`;
    }
}

export interface IpFilterOptions {
    ips: string[];
    message?: string;
}

/**
 * IP whitelist guard
 */
@Injectable()
export class IpWhitelistGuard implements Guard {
    constructor(private readonly options: IpFilterOptions) { }

    async canActivate(context: ExecutionContextWrapper): Promise<boolean> {
        const clientIp = context.getClientIp();

        if (!clientIp) {
            throw new ForbiddenException(this.options.message ?? 'Access denied');
        }

        const isAllowed = this.options.ips.some((ip) => this.matchIp(clientIp, ip));

        if (!isAllowed) {
            throw new ForbiddenException(this.options.message ?? 'Access denied');
        }

        return true;
    }

    private matchIp(clientIp: string, pattern: string): boolean {
        if (pattern === '*') return true;
        if (clientIp === pattern) return true;

        if (pattern.includes('/')) {
            return this.matchCIDR(clientIp, pattern);
        }

        if (pattern.includes('*')) {
            const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
            return regex.test(clientIp);
        }

        return false;
    }

    private matchCIDR(ip: string, cidr: string): boolean {
        const [range, bits] = cidr.split('/');
        if (!range || !bits) return false;

        const mask = parseInt(bits, 10);
        if (isNaN(mask) || mask < 0 || mask > 32) return false;

        const ipNum = this.ipToNumber(ip);
        const rangeNum = this.ipToNumber(range);

        if (ipNum === null || rangeNum === null) return false;

        const maskNum = (0xFFFFFFFF << (32 - mask)) >>> 0;
        return (ipNum & maskNum) === (rangeNum & maskNum);
    }

    private ipToNumber(ip: string): number | null {
        const parts = ip.split('.');
        if (parts.length !== 4) return null;

        let num = 0;
        for (let i = 0; i < 4; i++) {
            const part = parseInt(parts[i]!, 10);
            if (isNaN(part) || part < 0 || part > 255) return null;
            num = (num << 8) | part;
        }
        return num >>> 0;
    }
}

/**
 * IP blacklist guard
 */
@Injectable()
export class IpBlacklistGuard implements Guard {
    constructor(private readonly options: IpFilterOptions) { }

    async canActivate(context: ExecutionContextWrapper): Promise<boolean> {
        const clientIp = context.getClientIp();

        if (clientIp && this.options.ips.includes(clientIp)) {
            throw new ForbiddenException(this.options.message ?? 'Access denied');
        }

        return true;
    }
}

export interface KVThrottleOptions {
    kv: KVNamespace;
    limit?: number;
    ttl?: number;
    keyGenerator?: (context: ExecutionContextWrapper) => string;
    keyPrefix?: string;
}

@Injectable()
export class KVThrottleGuard implements Guard {
    private readonly limit: number;
    private readonly ttl: number;
    private readonly keyPrefix: string;

    constructor(private readonly options: KVThrottleOptions) {
        this.limit = options.limit ?? 100;
        this.ttl = options.ttl ?? 60;
        this.keyPrefix = options.keyPrefix ?? 'throttle:';
    }

    async canActivate(context: ExecutionContextWrapper): Promise<boolean> {
        const skipThrottle = context.getMetadata<boolean>('skipThrottle');
        if (skipThrottle) return true;

        const key = this.options.keyGenerator
            ? this.options.keyGenerator(context)
            : this.getDefaultKey(context);

        const fullKey = `${this.keyPrefix}${key}`;

        const current = await this.options.kv.get<number>(fullKey, 'json');
        const count = (current ?? 0) + 1;

        if (count > this.limit) {
            throw new ForbiddenException('Too many requests');
        }

        await this.options.kv.put(fullKey, JSON.stringify(count), {
            expirationTtl: this.ttl,
        });

        return true;
    }

    private getDefaultKey(context: ExecutionContextWrapper): string {
        const clientIp = context.getClientIp();
        const path = context.getRequest().url;
        return `${clientIp}:${path}`;
    }
}

export interface DOThrottleOptions {
    namespace: DurableObjectNamespace;
    limit?: number;
    ttl?: number;
    keyGenerator?: (context: ExecutionContextWrapper) => string;
    shardKeyGenerator?: (context: ExecutionContextWrapper) => string;
}

@Injectable()
export class DOThrottleGuard implements Guard {
    private readonly limit: number;
    private readonly ttl: number;

    constructor(private readonly options: DOThrottleOptions) {
        this.limit = options.limit ?? 100;
        this.ttl = options.ttl ?? 60;
    }

    async canActivate(context: ExecutionContextWrapper): Promise<boolean> {
        const skipThrottle = context.getMetadata<boolean>('skipThrottle');
        if (skipThrottle) return true;

        const shardKey = this.options.shardKeyGenerator
            ? this.options.shardKeyGenerator(context)
            : this.getDefaultShardKey(context);

        const id = this.options.namespace.idFromName(shardKey);
        const stub = this.options.namespace.get(id);

        const response = await stub.fetch('https://throttle/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                key: this.options.keyGenerator
                    ? this.options.keyGenerator(context)
                    : this.getDefaultKey(context),
                limit: this.limit,
                ttl: this.ttl,
            }),
        });

        if (!response.ok) {
            throw new ForbiddenException('Too many requests');
        }

        return true;
    }

    private getDefaultKey(context: ExecutionContextWrapper): string {
        const clientIp = context.getClientIp();
        const path = context.getRequest().url;
        return `${clientIp}:${path}`;
    }

    private getDefaultShardKey(context: ExecutionContextWrapper): string {
        const clientIp = context.getClientIp();
        if (!clientIp) return 'default';

        const parts = clientIp.split('.');
        return parts.slice(0, 3).join('.');
    }
}

/**
 * Cloudflare Rate Limiting binding interface
 */
export interface RateLimiter {
    limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface CFRateLimitGuardOptions {
    rateLimiter: RateLimiter;
    keyGenerator?: (context: ExecutionContextWrapper) => string;
}


/**
 * Guard using Cloudflare's native Rate Limiting binding
 */
@Injectable()
export class CFRateLimitGuard implements Guard {
    constructor(private readonly options: CFRateLimitGuardOptions) { }

    async canActivate(context: ExecutionContextWrapper): Promise<boolean> {
        const skipThrottle = context.getMetadata<boolean>('skipThrottle');
        if (skipThrottle) return true;

        const key = this.options.keyGenerator
            ? this.options.keyGenerator(context)
            : this.getDefaultKey(context);

        const { success } = await this.options.rateLimiter.limit({ key });

        if (!success) {
            throw new Response(JSON.stringify({
                statusCode: 429,
                message: 'Too Many Requests',
            }), {
                status: 429,
                headers: {
                    'Content-Type': 'application/json',
                    'X-RateLimit-Limit': 'configured in binding',
                },
            });
        }

        return true;
    }

    private getDefaultKey(context: ExecutionContextWrapper): string {
        return context.getClientIp() ?? 'unknown';
    }
}

const RATE_LIMIT_KEY = Symbol('ratelimit:config');

export interface RateLimitConfig {
    limit: number;
    window: number;
}

/**
 * Decorator to apply rate limiting metadata to a method
 * Use with ThrottleGuard or a custom guard that reads this metadata
 */
export function RateLimit(config: RateLimitConfig): MethodDecorator {
    return (target, propertyKey, descriptor) => {
        defineMethodMetadata(RATE_LIMIT_KEY, config, target.constructor, propertyKey);
        return descriptor;
    };
}

/**
 * Get rate limit config from metadata
 */
export function getRateLimitConfig(target: object, propertyKey: string | symbol): RateLimitConfig | undefined {
    return getMethodMetadata<RateLimitConfig>(RATE_LIMIT_KEY, target, propertyKey);
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    limit: number;
    reset: number;
    retryAfter?: number;
}

/**
 * Fixed window rate limiter (in-memory)
 */
export class FixedWindowRateLimiter {
    private store = new Map<string, { count: number; windowStart: number }>();

    check(key: string, limit: number, windowSeconds: number): RateLimitResult {
        const now = Date.now();
        const windowMs = windowSeconds * 1000;
        const windowStart = Math.floor(now / windowMs) * windowMs;
        const reset = Math.ceil((windowStart + windowMs) / 1000);

        let entry = this.store.get(key);

        if (!entry || entry.windowStart !== windowStart) {
            entry = { count: 0, windowStart };
        }

        if (entry.count >= limit) {
            return {
                allowed: false,
                remaining: 0,
                limit,
                reset,
                retryAfter: reset - Math.floor(now / 1000),
            };
        }

        entry.count++;
        this.store.set(key, entry);

        return {
            allowed: true,
            remaining: limit - entry.count,
            limit,
            reset,
        };
    }

    reset(key: string): void {
        this.store.delete(key);
    }

    clear(): void {
        this.store.clear();
    }
}

/**
 * Sliding window rate limiter (in-memory)
 * More accurate than fixed window but requires more storage
 */
export class SlidingWindowRateLimiter {
    private store = new Map<string, number[]>();

    check(key: string, limit: number, windowSeconds: number): RateLimitResult {
        const now = Date.now();
        const windowMs = windowSeconds * 1000;
        const windowStart = now - windowMs;
        const reset = Math.ceil((now + windowMs) / 1000);

        let timestamps = this.store.get(key) ?? [];
        timestamps = timestamps.filter((t) => t > windowStart);

        if (timestamps.length >= limit) {
            const oldestInWindow = timestamps[0]!;
            const retryAfter = Math.ceil((oldestInWindow + windowMs - now) / 1000);

            return {
                allowed: false,
                remaining: 0,
                limit,
                reset,
                retryAfter,
            };
        }

        timestamps.push(now);
        this.store.set(key, timestamps);

        return {
            allowed: true,
            remaining: limit - timestamps.length,
            limit,
            reset,
        };
    }

    reset(key: string): void {
        this.store.delete(key);
    }

    clear(): void {
        this.store.clear();
    }
}

export interface TokenBucketOptions {
    capacity: number;
    refillRate: number;
    refillInterval: number;
}

/**
 * Token bucket rate limiter (in-memory)
 * Allows bursts while maintaining average rate
 */
export class TokenBucketRateLimiter {
    private store = new Map<string, { tokens: number; lastRefill: number }>();

    check(key: string, options: TokenBucketOptions): RateLimitResult {
        const now = Date.now();
        const { capacity, refillRate, refillInterval } = options;
        const refillMs = refillInterval * 1000;

        let bucket = this.store.get(key);

        if (!bucket) {
            bucket = { tokens: capacity, lastRefill: now };
        }

        const timeSinceRefill = now - bucket.lastRefill;
        const tokensToAdd = Math.floor(timeSinceRefill / refillMs) * refillRate;

        if (tokensToAdd > 0) {
            bucket.tokens = Math.min(capacity, bucket.tokens + tokensToAdd);
            bucket.lastRefill = now;
        }

        const reset = Math.ceil((now + refillMs) / 1000);

        if (bucket.tokens < 1) {
            const waitTime = Math.ceil((refillMs - (now - bucket.lastRefill)) / 1000);

            return {
                allowed: false,
                remaining: 0,
                limit: capacity,
                reset,
                retryAfter: waitTime,
            };
        }

        bucket.tokens--;
        this.store.set(key, bucket);

        return {
            allowed: true,
            remaining: bucket.tokens,
            limit: capacity,
            reset,
        };
    }

    reset(key: string): void {
        this.store.delete(key);
    }
}

export interface RateLimitKeyOptions {
    prefix?: string;
    suffix?: string;
}

/**
 * Utility functions for building rate limit keys
 */
export const RateLimitKeys = {
    fromIp(request: Request, options?: RateLimitKeyOptions): string {
        const ip = request.headers.get('cf-connecting-ip') ??
            request.headers.get('x-forwarded-for')?.split(',')[0] ??
            'unknown';
        return buildKey(ip, options);
    },

    fromUser(userId: string, options?: RateLimitKeyOptions): string {
        return buildKey(`user:${userId}`, options);
    },

    fromApiKey(apiKey: string, options?: RateLimitKeyOptions): string {
        return buildKey(`api:${apiKey}`, options);
    },

    fromPath(request: Request, options?: RateLimitKeyOptions): string {
        const url = new URL(request.url);
        return buildKey(`path:${url.pathname}`, options);
    },

    fromIpAndPath(request: Request, options?: RateLimitKeyOptions): string {
        const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
        const url = new URL(request.url);
        return buildKey(`${ip}:${url.pathname}`, options);
    },
};

function buildKey(base: string, options?: RateLimitKeyOptions): string {
    let key = base;
    if (options?.prefix) key = `${options.prefix}:${key}`;
    if (options?.suffix) key = `${key}:${options.suffix}`;
    return key;
}

/**
 * Create rate limit headers for a response
 */
export function createRateLimitHeaders(result: RateLimitResult): Headers {
    const headers = new Headers();
    headers.set('X-RateLimit-Limit', String(result.limit));
    headers.set('X-RateLimit-Remaining', String(result.remaining));
    headers.set('X-RateLimit-Reset', String(result.reset));

    if (!result.allowed && result.retryAfter) {
        headers.set('Retry-After', String(result.retryAfter));
    }

    return headers;
}

/**
 * Create a 429 Too Many Requests response
 */
export function createRateLimitedResponse(result: RateLimitResult, message?: string): Response {
    return new Response(
        JSON.stringify({
            error: message ?? 'Too Many Requests',
            retryAfter: result.retryAfter,
        }),
        {
            status: 429,
            headers: createRateLimitHeaders(result),
        }
    );
}
