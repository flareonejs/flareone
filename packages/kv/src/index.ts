/**
 * @flareone/kv - Workers KV Integration
 * High-level, type-safe wrapper for Cloudflare Workers KV
 */

import {
    Injectable,
    Module,
    createToken,
    type Type,
    type DynamicModule,
    type InjectionToken,
} from '@flareone/core';

export interface KVGetOptions {
    type?: 'text' | 'json' | 'arrayBuffer' | 'stream';
    cacheTtl?: number;
}

export interface KVPutOptions {
    expiration?: number;
    expirationTtl?: number;
    metadata?: Record<string, unknown>;
}

export interface KVListOptions {
    prefix?: string;
    limit?: number;
    cursor?: string;
}
export interface KVListResult<T = unknown> {
    keys: Array<{
        name: string;
        expiration?: number;
        metadata?: T;
    }>;
    list_complete: boolean;
    cursor?: string;
}

export interface KVValueWithMetadata<T, M = unknown> {
    value: T | null;
    metadata: M | null;
}

export interface KVModuleOptions {
    binding: string;
    defaultTtl?: number;
    keyPrefix?: string;
    enableCache?: boolean;
    cacheTtl?: number;
}

export interface KVModuleAsyncOptions {
    imports?: Array<Type | DynamicModule>;
    useFactory: (...args: unknown[]) => KVModuleOptions | Promise<KVModuleOptions>;
    inject?: InjectionToken[];
}

export const KV_OPTIONS = createToken<KVModuleOptions>('KV_OPTIONS');
export const KV_NAMESPACE = createToken<KVNamespace>('KV_NAMESPACE');

/**
 * High-level KV service with type-safe operations
 */
@Injectable()
export class KVService {
    private namespace: KVNamespace | null = null;
    private options: KVModuleOptions | null = null;

    /**
     * Initialize with KV namespace and options
     */
    initialize(namespace: KVNamespace, options: KVModuleOptions): void {
        this.namespace = namespace;
        this.options = options;
    }

    /**
     * Get the underlying KV namespace
     */
    getNamespace(): KVNamespace {
        if (!this.namespace) {
            throw new Error('KV namespace not initialized. Make sure KVModule is properly configured.');
        }
        return this.namespace;
    }

    /**
     * Build the full key with optional prefix
     */
    private buildKey(key: string): string {
        return this.options?.keyPrefix ? `${this.options.keyPrefix}${key}` : key;
    }

    /**
     * Get a value by key
     */
    async get<T = string>(key: string, options?: KVGetOptions): Promise<T | null> {
        const ns = this.getNamespace();
        const fullKey = this.buildKey(key);
        const type = options?.type ?? 'json';
        const cacheTtl = options?.cacheTtl ?? this.options?.cacheTtl;

        const kvOptions: KVNamespaceGetOptions<any> = { type };
        if (cacheTtl) {
            kvOptions.cacheTtl = cacheTtl;
        }

        return ns.get(fullKey, kvOptions) as Promise<T | null>;
    }

    /**
     * Get a value as text
     */
    async getText(key: string, cacheTtl?: number): Promise<string | null> {
        return this.get<string>(key, { type: 'text', cacheTtl });
    }

    /**
     * Get a value as JSON
     */
    async getJson<T>(key: string, cacheTtl?: number): Promise<T | null> {
        return this.get<T>(key, { type: 'json', cacheTtl });
    }

    /**
     * Get a value as ArrayBuffer
     */
    async getArrayBuffer(key: string, cacheTtl?: number): Promise<ArrayBuffer | null> {
        return this.get<ArrayBuffer>(key, { type: 'arrayBuffer', cacheTtl });
    }

    /**
     * Get a value as ReadableStream
     */
    async getStream(key: string, cacheTtl?: number): Promise<ReadableStream | null> {
        return this.get<ReadableStream>(key, { type: 'stream', cacheTtl });
    }

    /**
     * Get a value with its metadata
     */
    async getWithMetadata<T = unknown, M = unknown>(
        key: string,
        type: 'text' | 'json' | 'arrayBuffer' | 'stream' = 'json'
    ): Promise<KVValueWithMetadata<T, M>> {
        const ns = this.getNamespace();
        const fullKey = this.buildKey(key);
        const result = await (ns.getWithMetadata as (key: string, options: { type: string }) => Promise<{ value: unknown; metadata: unknown }>)(fullKey, { type });
        return {
            value: result.value as T | null,
            metadata: result.metadata as M | null,
        };
    }

    /**
     * Set a value
     */
    async set<T = unknown>(
        key: string,
        value: T,
        options?: KVPutOptions
    ): Promise<void> {
        const ns = this.getNamespace();
        const fullKey = this.buildKey(key);

        const serialized = typeof value === 'string' ? value : JSON.stringify(value);

        const kvOptions: KVNamespacePutOptions = {};
        if (options?.expiration) {
            kvOptions.expiration = options.expiration;
        }
        if (options?.expirationTtl ?? this.options?.defaultTtl) {
            kvOptions.expirationTtl = options?.expirationTtl ?? this.options?.defaultTtl;
        }
        if (options?.metadata) {
            kvOptions.metadata = options.metadata;
        }

        await ns.put(fullKey, serialized, kvOptions);
    }

    /**
     * Set multiple values at once
     */
    async setMany<T = unknown>(
        entries: Array<{ key: string; value: T; options?: KVPutOptions }>
    ): Promise<void> {
        await Promise.all(
            entries.map(({ key, value, options }) => this.set(key, value, options))
        );
    }

    /**
     * Set a value with automatic JSON serialization
     */
    async setJson<T>(key: string, value: T, options?: KVPutOptions): Promise<void> {
        return this.set(key, value, options);
    }

    /**
     * Set a value as raw text
     */
    async setText(key: string, value: string, options?: KVPutOptions): Promise<void> {
        const ns = this.getNamespace();
        const fullKey = this.buildKey(key);

        const kvOptions: KVNamespacePutOptions = {};
        if (options?.expiration) kvOptions.expiration = options.expiration;
        if (options?.expirationTtl ?? this.options?.defaultTtl) {
            kvOptions.expirationTtl = options?.expirationTtl ?? this.options?.defaultTtl;
        }
        if (options?.metadata) kvOptions.metadata = options.metadata;

        await ns.put(fullKey, value, kvOptions);
    }

    /**
     * Set a value as ArrayBuffer
     */
    async setArrayBuffer(
        key: string,
        value: ArrayBuffer,
        options?: KVPutOptions
    ): Promise<void> {
        const ns = this.getNamespace();
        const fullKey = this.buildKey(key);

        const kvOptions: KVNamespacePutOptions = {};
        if (options?.expiration) kvOptions.expiration = options.expiration;
        if (options?.expirationTtl ?? this.options?.defaultTtl) {
            kvOptions.expirationTtl = options?.expirationTtl ?? this.options?.defaultTtl;
        }
        if (options?.metadata) kvOptions.metadata = options.metadata;

        await ns.put(fullKey, value, kvOptions);
    }

    /**
     * Delete a key
     */
    async delete(key: string): Promise<void> {
        const ns = this.getNamespace();
        const fullKey = this.buildKey(key);
        await ns.delete(fullKey);
    }

    /**
     * Delete multiple keys
     */
    async deleteMany(keys: string[]): Promise<void> {
        await Promise.all(keys.map((key) => this.delete(key)));
    }

    /**
     * Delete all keys with a prefix
     */
    async deleteByPrefix(prefix: string): Promise<number> {
        const keys = await this.keys(prefix);
        await this.deleteMany(keys.map((k) => k.name));
        return keys.length;
    }

    /**
     * List keys
     */
    async list<M = unknown>(options?: KVListOptions): Promise<KVListResult<M>> {
        const ns = this.getNamespace();

        const kvOptions: KVNamespaceListOptions = {};
        if (options?.prefix) {
            kvOptions.prefix = this.buildKey(options.prefix);
        }
        if (options?.limit) {
            kvOptions.limit = options.limit;
        }
        if (options?.cursor) {
            kvOptions.cursor = options.cursor;
        }

        return ns.list(kvOptions) as Promise<KVListResult<M>>;
    }

    /**
     * Get all keys (handles pagination automatically)
     */
    async keys<M = unknown>(prefix?: string): Promise<Array<{ name: string; metadata?: M }>> {
        const allKeys: Array<{ name: string; metadata?: M }> = [];
        let cursor: string | undefined;
        let complete = false;

        while (!complete) {
            const result = await this.list<M>({
                prefix,
                cursor,
                limit: 1000,
            });

            allKeys.push(...result.keys);
            complete = result.list_complete;
            cursor = result.cursor;
        }

        return allKeys;
    }

    /**
     * Check if a key exists
     */
    async exists(key: string): Promise<boolean> {
        const value = await this.get(key, { type: 'text' });
        return value !== null;
    }

    /**
     * Get or set a value (cache pattern)
     */
    async getOrSet<T>(
        key: string,
        factory: () => T | Promise<T>,
        options?: KVPutOptions
    ): Promise<T> {
        const existing = await this.get<T>(key);
        if (existing !== null) {
            return existing;
        }

        const value = await factory();
        await this.set(key, value, options);
        return value;
    }

    /**
     * Increment a numeric value
     */
    async increment(key: string, delta: number = 1): Promise<number> {
        const current = await this.get<number>(key);
        const newValue = (current ?? 0) + delta;
        await this.set(key, newValue);
        return newValue;
    }

    /**
     * Decrement a numeric value
     */
    async decrement(key: string, delta: number = 1): Promise<number> {
        return this.increment(key, -delta);
    }

    /**
     * Append to an array stored in KV
     */
    async append<T>(key: string, item: T, options?: KVPutOptions): Promise<T[]> {
        const existing = await this.get<T[]>(key) ?? [];
        existing.push(item);
        await this.set(key, existing, options);
        return existing;
    }

    /**
     * Update a value with a transformer function
     */
    async update<T>(
        key: string,
        updater: (current: T | null) => T,
        options?: KVPutOptions
    ): Promise<T> {
        const current = await this.get<T>(key);
        const updated = updater(current);
        await this.set(key, updated, options);
        return updated;
    }
}

/**
 * Base class for creating typed KV repositories
 */
export abstract class KVRepository<T, M = unknown> {
    constructor(
        protected readonly kv: KVService,
        protected readonly prefix: string
    ) { }

    /**
     * Build the full key for an entity
     */
    protected buildKey(id: string): string {
        return `${this.prefix}:${id}`;
    }

    /**
     * Find an entity by ID
     */
    async findById(id: string): Promise<T | null> {
        return this.kv.get<T>(this.buildKey(id));
    }

    /**
     * Find an entity by ID with metadata
     */
    async findByIdWithMetadata(id: string): Promise<KVValueWithMetadata<T, M>> {
        return this.kv.getWithMetadata<T, M>(this.buildKey(id));
    }

    /**
     * Save an entity
     */
    async save(id: string, entity: T, options?: KVPutOptions): Promise<void> {
        await this.kv.set(this.buildKey(id), entity, options);
    }

    /**
     * Delete an entity
     */
    async delete(id: string): Promise<void> {
        await this.kv.delete(this.buildKey(id));
    }

    /**
     * Check if an entity exists
     */
    async exists(id: string): Promise<boolean> {
        return this.kv.exists(this.buildKey(id));
    }

    /**
     * Get all entity IDs
     */
    async getAllIds(): Promise<string[]> {
        const keys = await this.kv.keys(`${this.prefix}:`);
        return keys.map((k) => k.name.replace(`${this.prefix}:`, ''));
    }

    /**
     * Get all entities
     */
    async findAll(): Promise<T[]> {
        const ids = await this.getAllIds();
        const entities = await Promise.all(ids.map((id) => this.findById(id)));
        return entities.filter((e): e is NonNullable<typeof e> => e !== null) as T[];
    }

    /**
     * Count entities
     */
    async count(): Promise<number> {
        const keys = await this.kv.keys(`${this.prefix}:`);
        return keys.length;
    }

    /**
     * Delete all entities
     */
    async deleteAll(): Promise<number> {
        return this.kv.deleteByPrefix(`${this.prefix}:`);
    }
}

/**
 * Parameter decorator to inject KV namespace directly
 */
export function InjectKV(binding: string): ParameterDecorator {
    return (target, propertyKey, parameterIndex) => {
        const metaKey = `__kv_bindings_${String(propertyKey)}`;
        const existingParams = (target as Record<string, unknown>)[metaKey] as Array<{ index: number; binding: string }> ?? [];
        existingParams.push({ index: parameterIndex, binding });
        (target as Record<string, unknown>)[metaKey] = existingParams;
    };
}

/**
 * KV Module for Flareone
 */
@Module({})
export class KVModule {
    /**
     * Configure KV module with static options
     */
    static forRoot(options: KVModuleOptions): DynamicModule {
        return {
            module: KVModule,
            providers: [
                { provide: KV_OPTIONS, useValue: options },
                KVService,
            ],
            exports: [KVService, KV_OPTIONS],
        };
    }

    /**
     * Configure KV module with async options
     */
    static forRootAsync(options: KVModuleAsyncOptions): DynamicModule {
        return {
            module: KVModule,
            imports: options.imports ?? [],
            providers: [
                {
                    provide: KV_OPTIONS,
                    useFactory: options.useFactory,
                    inject: options.inject,
                },
                KVService,
            ],
            exports: [KVService, KV_OPTIONS],
        };
    }

    /**
     * Configure KV for a specific feature/namespace
     */
    static forFeature(options: KVModuleOptions): DynamicModule {
        const featureToken = createToken<KVService>(`KV_${options.binding}`);

        return {
            module: KVModule,
            providers: [
                { provide: featureToken, useClass: KVService },
                { provide: `KV_OPTIONS_${options.binding}`, useValue: options },
            ],
            exports: [featureToken],
        };
    }
}

/**
 * Create a KV service for a specific namespace
 */
export function createKVService(
    namespace: KVNamespace,
    options: Partial<KVModuleOptions> = {}
): KVService {
    const service = new KVService();
    service.initialize(namespace, {
        binding: 'custom',
        ...options,
    });
    return service;
}

/**
 * Helper to get KV namespace from environment
 */
export function getKVNamespace(env: Record<string, unknown>, binding: string): KVNamespace {
    const namespace = env[binding] as KVNamespace | undefined;
    if (!namespace) {
        throw new Error(`KV namespace '${binding}' not found in environment`);
    }
    return namespace;
}
