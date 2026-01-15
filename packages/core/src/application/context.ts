/**
 * Execution Context
 * just a wrapper to make grabbing request data slightly less painful.
 */

import type {
    Type,
    Func,
    ExecutionContextWrapper,
    RouteHandler,
} from '../types.js';
import { getClassMetadata, getMethodMetadata } from '../metadata.js';

/**
 * Execution context wrapper providing access to request data
 */
export class FlareoneExecutionContext implements ExecutionContextWrapper {
    private readonly customData: Map<string, unknown> = new Map();
    private parsedParams?: Record<string, string>;
    private parsedQuery?: URLSearchParams;

    constructor(
        private readonly request: Request,
        private readonly env: unknown,
        private readonly executionContext: ExecutionContext,
        private readonly handler: RouteHandler,
        private readonly params: Record<string, string> = {}
    ) { }

    /**
     * Get the original Request object
     */
    getRequest(): Request {
        return this.request;
    }

    /**
     * Get the environment bindings
     */
    getEnv<T = unknown>(): T {
        return this.env as T;
    }

    /**
     * Get the Cloudflare ExecutionContext
     */
    getExecutionContext(): ExecutionContext {
        return this.executionContext;
    }

    /**
     * Get the controller class
     */
    getClass(): Type {
        return this.handler.controller.constructor as Type;
    }

    /**
     * Get the handler method
     */
    getHandler(): Func {
        const methodName = this.handler.methodName;
        return (this.handler.controller as Record<string, Func>)[methodName] as Func;
    }

    /**
     * Get route parameters
     */
    getParams(): Record<string, string> {
        if (!this.parsedParams) {
            this.parsedParams = { ...this.params };
        }
        return this.parsedParams;
    }

    /**
     * Get a specific route parameter
     */
    getParam(name: string): string | undefined {
        return this.getParams()[name];
    }

    /**
     * Get query parameters
     */
    getQuery(): URLSearchParams {
        if (!this.parsedQuery) {
            const url = new URL(this.request.url);
            this.parsedQuery = url.searchParams;
        }
        return this.parsedQuery;
    }

    /**
     * Get a specific query parameter
     */
    getQueryParam(name: string): string | null {
        return this.getQuery().get(name);
    }

    /**
     * Get request headers
     */
    getHeaders(): Headers {
        return this.request.headers;
    }

    /**
     * Get a specific header
     */
    getHeader(name: string): string | null {
        return this.request.headers.get(name);
    }

    /**
     * Get handler metadata by key
     */
    getMetadata<T>(key: string): T | undefined {
        const methodMeta = getMethodMetadata<T>(
            key,
            this.handler.controller,
            this.handler.methodName
        );
        if (methodMeta !== undefined) return methodMeta;

        return getClassMetadata<T>(key, this.handler.controller.constructor);
    }

    /**
     * Set custom context data
     */
    setData(key: string, value: unknown): void {
        this.customData.set(key, value);
    }

    /**
     * Get custom context data
     */
    getData<T>(key: string): T | undefined {
        return this.customData.get(key) as T | undefined;
    }

    /**
     * Get the request URL
     */
    getUrl(): URL {
        return new URL(this.request.url);
    }

    /**
     * Get the HTTP method
     */
    getMethod(): string {
        return this.request.method;
    }

    /**
     * Get the request body as JSON
     */
    async getBody<T = unknown>(): Promise<T> {
        const clone = this.request.clone();
        return clone.json() as Promise<T>;
    }

    /**
     * Get the request body as text
     */
    async getBodyText(): Promise<string> {
        const clone = this.request.clone();
        return clone.text();
    }

    /**
     * Get the request body as form data
     */
    async getFormData(): Promise<FormData> {
        const clone = this.request.clone();
        return clone.formData();
    }

    /**
     * Get Cloudflare-specific request properties
     */
    getCfProperties(): IncomingRequestCfProperties | undefined {
        return (this.request as unknown as { cf: IncomingRequestCfProperties }).cf;
    }

    /**
     * Get client IP address
     */
    getClientIp(): string | null {
        return (
            this.request.headers.get('cf-connecting-ip') ??
            this.request.headers.get('x-real-ip') ??
            this.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
            null
        );
    }

    /**
     * Get client country (from Cloudflare)
     */
    getCountry(): string | undefined {
        return this.getCfProperties()?.country as string | undefined;
    }

    /**
     * Switch to using waitUntil
     */
    waitUntil(promise: Promise<unknown>): void {
        this.executionContext.waitUntil(promise);
    }

    /**
     * Pass through on exception
     */
    passThroughOnException(): void {
        this.executionContext.passThroughOnException();
    }
}

/**
 * Call handler for interceptors
 */
export class FlareoneCallHandler<T = unknown> {
    constructor(private readonly handlerFn: () => Promise<T>) { }

    /**
     * Proceed to the next handler in the chain
     */
    handle(): Promise<T> {
        return this.handlerFn();
    }
}
