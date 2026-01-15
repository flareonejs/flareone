/**
 * types, types everywhere. 
 * keep this file clean or i'll lose my mind.
 */

import type { HttpMethod, HttpStatus, ProviderScope } from './constants.js';

/** Any class constructor */
export type Type<T = unknown> = new (...args: any[]) => T;

/** Abstract class constructor */
export type AbstractType<T = unknown> = abstract new (...args: any[]) => T;

/** Function type */
export type Func<TArgs extends unknown[] = unknown[], TReturn = unknown> = (
    ...args: TArgs
) => TReturn;

/** Async function type */
export type AsyncFunc<TArgs extends unknown[] = unknown[], TReturn = unknown> = (
    ...args: TArgs
) => Promise<TReturn>;

/** Class decorator */
export type ClassDecorator<T extends Type = Type> = (target: T) => T | void;

/** Method decorator */
export type MethodDecorator = <T>(
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>
) => TypedPropertyDescriptor<T> | void;

/** Parameter decorator */
export type ParameterDecorator = (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
) => void;

/** Property decorator */
export type PropertyDecorator = (target: object, propertyKey: string | symbol) => void;

/** Make all properties optional recursively */
export type DeepPartial<T> = T extends object
    ? { [P in keyof T]?: DeepPartial<T[P]> }
    : T;

/** Extract return type of async function */
export type AsyncReturnType<T extends AsyncFunc> = T extends AsyncFunc<unknown[], infer R>
    ? R
    : never;

/** Symbol-based injection token */
export type InjectionTokenSymbol = symbol | string;

/** Class-based or symbol injection token */
export type InjectionToken<T = unknown> = Type<T> | AbstractType<T> | InjectionTokenSymbol;

/** Token factory for creating typed tokens */
export function createToken<T>(description: string): InjectionToken<T> {
    return Symbol.for(`flareone:${description}`);
}

/** Class provider - instantiate the class */
export interface ClassProvider<T = unknown> {
    provide: InjectionToken<T>;
    useClass: Type<T>;
    scope?: ProviderScope;
}

/** Value provider - use the exact value */
export interface ValueProvider<T = unknown> {
    provide: InjectionToken<T>;
    useValue: T;
}

/** Factory provider - call factory to create value */
export interface FactoryProvider<T = unknown> {
    provide: InjectionToken<T>;
    useFactory: (...args: unknown[]) => T | Promise<T>;
    inject?: InjectionToken[];
    scope?: ProviderScope;
}

/** Existing provider - alias to another token */
export interface ExistingProvider<T = unknown> {
    provide: InjectionToken<T>;
    useExisting: InjectionToken<T>;
}

/** Any provider type */
export type Provider<T = unknown> =
    | Type<T>
    | ClassProvider<T>
    | ValueProvider<T>
    | FactoryProvider<T>
    | ExistingProvider<T>;

/** Check if provider is ClassProvider */
export function isClassProvider<T>(provider: Provider<T>): provider is ClassProvider<T> {
    return (provider as ClassProvider<T>).useClass !== undefined;
}

/** Check if provider is ValueProvider */
export function isValueProvider<T>(provider: Provider<T>): provider is ValueProvider<T> {
    return (provider as ValueProvider<T>).useValue !== undefined;
}

/** Check if provider is FactoryProvider */
export function isFactoryProvider<T>(provider: Provider<T>): provider is FactoryProvider<T> {
    return (provider as FactoryProvider<T>).useFactory !== undefined;
}

/** Check if provider is ExistingProvider */
export function isExistingProvider<T>(provider: Provider<T>): provider is ExistingProvider<T> {
    return (provider as ExistingProvider<T>).useExisting !== undefined;
}

/** Check if provider is a class */
export function isTypeProvider<T>(provider: Provider<T>): provider is Type<T> {
    return typeof provider === 'function';
}

/** Static module metadata */
export interface ModuleMetadata {
    imports?: Array<Type | DynamicModule | Promise<DynamicModule>>;
    controllers?: Type[];
    providers?: Provider[];
    exports?: Array<InjectionToken | Provider>;
}

/** Dynamic module configuration */
export interface DynamicModule extends ModuleMetadata {
    module: Type;
    global?: boolean;
}

/** Module options for forRoot/forFeature patterns */
export interface ModuleOptions {
    isGlobal?: boolean;
}

/** Controller metadata options */
export interface ControllerOptions {
    path?: string;
    version?: string | string[];
    host?: string | string[];
    scope?: ProviderScope;
}

/** Route metadata */
export interface RouteMetadata {
    method: HttpMethod;
    path: string;
    methodName: string;
    statusCode?: HttpStatus;
    headers?: Record<string, string>;
}

/** Route handler */
export interface RouteHandler {
    controller: object;
    methodName: string;
    metadata: RouteMetadata;
    guards: Guard[];
    interceptors: Interceptor[];
    pipes: PipeTransform[];
    params: ParameterMetadata[];
}

/** Parameter metadata for route handlers */
export interface ParameterMetadata {
    index: number;
    type: 'param' | 'query' | 'body' | 'headers' | 'request' | 'response' | 'context' | 'env' | 'custom';
    name?: string;
    pipes?: PipeTransform[];
    data?: unknown;
}

/** Middleware function signature */
export type MiddlewareFunction = (
    request: Request,
    env: unknown,
    ctx: ExecutionContext,
    next: () => Promise<Response>
) => Promise<Response> | Response;

/** Middleware class interface */
export interface Middleware {
    use: MiddlewareFunction;
}

/** Middleware configuration */
export interface MiddlewareConfig {
    middleware: Type<Middleware> | MiddlewareFunction;
    forRoutes?: Array<string | RouteInfo>;
    exclude?: Array<string | RouteInfo>;
}

/** Route info for middleware configuration */
export interface RouteInfo {
    path: string;
    method?: HttpMethod;
}

/** Guard interface */
export interface Guard {
    canActivate(context: ExecutionContextWrapper): boolean | Promise<boolean>;
}

/** Interceptor interface */
export interface Interceptor<TInput = unknown, TOutput = unknown> {
    intercept(
        context: ExecutionContextWrapper,
        next: CallHandler<TInput>
    ): Promise<TOutput> | TOutput;
}

/** Call handler for interceptors */
export interface CallHandler<T = unknown> {
    handle(): Promise<T>;
}

/** Pipe transform interface */
export interface PipeTransform<TInput = unknown, TOutput = unknown> {
    transform(value: TInput, metadata: ArgumentMetadata): TOutput | Promise<TOutput>;
}

/** Argument metadata for pipes */
export interface ArgumentMetadata {
    type: 'body' | 'query' | 'param' | 'custom';
    name?: string;
    data?: unknown;
    metatype?: Type;
}

/** Exception filter interface */
export interface ExceptionFilter<T = unknown> {
    catch(exception: T, context: ExecutionContextWrapper): Response | Promise<Response>;
}

/** Exception filter metadata */
export interface ExceptionFilterMetadata {
    exceptions: Type<Error>[];
    filter: ExceptionFilter;
}

/** Wrapped execution context with helper methods */
export interface ExecutionContextWrapper {
    getRequest(): Request;
    getEnv<T = unknown>(): T;
    getExecutionContext(): ExecutionContext;
    getClass(): Type;
    getHandler(): Func;
    getParams(): Record<string, string>;
    getQuery(): URLSearchParams;
    getQueryParam(name: string): string | null;
    getUrl(): URL;
    getClientIp(): string | null;
    getHeaders(): Headers;
    getMetadata<T>(key: string): T | undefined;
    setData(key: string, value: unknown): void;
    getData<T>(key: string): T | undefined;
}

/** Cloudflare Workers environment interface */
export interface WorkerEnv {
    [key: string]: unknown;
}

/** Flareone application options */
export interface FlareoneApplicationOptions {
    cors?: boolean | CorsOptions;
    globalPrefix?: string;
    guards?: Array<Type<Guard> | Guard>;
    interceptors?: Array<Type<Interceptor> | Interceptor>;
    pipes?: Array<Type<PipeTransform> | PipeTransform>;
    filters?: Array<Type<ExceptionFilter> | ExceptionFilter>;
    logging?: boolean | LoggingOptions;
}

/** CORS options */
export interface CorsOptions {
    origin?: string | string[] | boolean | ((origin: string) => boolean);
    methods?: HttpMethod[];
    allowedHeaders?: string[];
    exposedHeaders?: string[];
    credentials?: boolean;
    maxAge?: number;
    preflightContinue?: boolean;
    optionsSuccessStatus?: number;
}

/** Logging options */
export interface LoggingOptions {
    level?: 'debug' | 'info' | 'warn' | 'error';
    includeBody?: boolean;
    includeResponseBody?: boolean;
    logger?: (message: string, data?: unknown) => void;
}

/** Called after module initialization */
export interface OnModuleInit {
    onModuleInit(): void | Promise<void>;
}

/** Called before module destruction */
export interface OnModuleDestroy {
    onModuleDestroy(): void | Promise<void>;
}

/** Called before application starts listening */
export interface OnApplicationBootstrap {
    onApplicationBootstrap(): void | Promise<void>;
}

/** Called before application shuts down */
export interface OnApplicationShutdown {
    onApplicationShutdown(signal?: string): void | Promise<void>;
}

/** Base binding interface */
export interface CloudflareBinding {
    readonly name: string;
}

/** KV Namespace binding */
export interface KVBinding extends CloudflareBinding {
    get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream' }): Promise<unknown>;
    put(key: string, value: string | ArrayBuffer | ReadableStream, options?: { expiration?: number; expirationTtl?: number }): Promise<void>;
    delete(key: string): Promise<void>;
    list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{ keys: { name: string }[]; cursor?: string }>;
}

/** Durable Object binding */
export interface DurableObjectBinding extends CloudflareBinding {
    get(id: DurableObjectId): DurableObjectStub;
    idFromName(name: string): DurableObjectId;
    idFromString(id: string): DurableObjectId;
    newUniqueId(options?: { jurisdiction?: string }): DurableObjectId;
}

/** R2 bucket binding */
export interface R2Binding extends CloudflareBinding {
    get(key: string): Promise<R2Object | null>;
    put(key: string, value: ReadableStream | ArrayBuffer | string, options?: R2PutOptions): Promise<R2Object>;
    delete(key: string): Promise<void>;
    list(options?: R2ListOptions): Promise<R2Objects>;
    head(key: string): Promise<R2Object | null>;
}

/** R2 put options */
export interface R2PutOptions {
    httpMetadata?: R2HTTPMetadata;
    customMetadata?: Record<string, string>;
}

/** R2 HTTP metadata */
export interface R2HTTPMetadata {
    contentType?: string;
    contentLanguage?: string;
    contentDisposition?: string;
    contentEncoding?: string;
    cacheControl?: string;
    cacheExpiry?: Date;
}

/** R2 list options */
export interface R2ListOptions {
    prefix?: string;
    limit?: number;
    cursor?: string;
    delimiter?: string;
    include?: ('httpMetadata' | 'customMetadata')[];
}

/** R2 object */
export interface R2Object {
    key: string;
    version: string;
    size: number;
    etag: string;
    httpEtag: string;
    uploaded: Date;
    httpMetadata?: R2HTTPMetadata;
    customMetadata?: Record<string, string>;
    body?: ReadableStream;
    bodyUsed?: boolean;
    arrayBuffer(): Promise<ArrayBuffer>;
    text(): Promise<string>;
    json<T>(): Promise<T>;
    blob(): Promise<Blob>;
}

/** R2 objects list */
export interface R2Objects {
    objects: R2Object[];
    truncated: boolean;
    cursor?: string;
    delimitedPrefixes: string[];
}

/** D1 database binding */
export interface D1Binding extends CloudflareBinding {
    prepare(query: string): D1PreparedStatement;
    batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
    exec(query: string): Promise<D1ExecResult>;
}

/** D1 prepared statement */
export interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    first<T>(column?: string): Promise<T | null>;
    all<T>(): Promise<D1Result<T>>;
    run<T>(): Promise<D1Result<T>>;
    raw<T>(): Promise<T[]>;
}

/** D1 result */
export interface D1Result<T = unknown> {
    results: T[];
    success: boolean;
    meta: {
        duration: number;
        changes: number;
        last_row_id: number;
        rows_read: number;
        rows_written: number;
    };
}

/** D1 exec result */
export interface D1ExecResult {
    count: number;
    duration: number;
}

/** Queue binding */
export interface QueueBinding extends CloudflareBinding {
    send<T>(message: T, options?: QueueSendOptions): Promise<void>;
    sendBatch<T>(messages: Array<{ body: T; options?: QueueSendOptions }>): Promise<void>;
}

/** Queue send options */
export interface QueueSendOptions {
    contentType?: 'json' | 'text' | 'bytes';
    delaySeconds?: number;
}

/** Service binding for worker-to-worker communication */
export interface ServiceBinding extends CloudflareBinding {
    fetch(request: Request | string, init?: RequestInit): Promise<Response>;
}
