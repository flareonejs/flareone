/**
 * the app factory. where all modules meet and hope not to crash.
 */

import { Container } from '../di/container.js';
import { Router } from '../router/radix-router.js';
import { CONTROLLER_METADATA, ROUTE_METADATA, type HttpMethod } from '../constants.js';
import { getClassMetadata, getDecoratedMethods, getMethodMetadata } from '../metadata.js';
import { getModuleMetadata, isDynamicModule } from '../decorators/module.js';
import { getGuards, getInterceptors, getPipes } from '../decorators/enhancers.js';
import { getParameterDecorators } from '../router/params.js';
import { FlareoneExecutionContext, FlareoneCallHandler } from './context.js';
import {
    HttpException,
    NotFoundException,
    InternalServerErrorException,
    errorToResponse,
} from '../exceptions/http-exceptions.js';
import type {
    Type,
    Provider,
    DynamicModule,
    RouteHandler,
    RouteMetadata,
    FlareoneApplicationOptions,
    Guard,
    Interceptor,
    PipeTransform,
    ExceptionFilter,
    CorsOptions,
} from '../types.js';


// the application class. 
// it manages everything from di to routing. it's huge.

export class FlareoneApplication {
    private readonly container: Container;
    private readonly router: Router;
    private readonly options: FlareoneApplicationOptions;
    private readonly moduleInstances: Map<Type, object> = new Map();
    private readonly controllerInstances: Map<Type, object> = new Map();
    private isInitialized = false;

    // Global enhancers
    private globalGuards: Array<Guard> = [];
    private globalInterceptors: Array<Interceptor> = [];
    private globalPipes: Array<PipeTransform> = [];
    private globalFilters: Array<ExceptionFilter> = [];

    constructor(
        private readonly rootModule: Type,
        options: FlareoneApplicationOptions = {}
    ) {
        this.container = new Container();
        this.router = new Router();
        this.options = options;
    }

    /**
     * Initialize the application
     */
    async init(): Promise<this> {
        if (this.isInitialized) return this;

        await this.processModule(this.rootModule);
        await this.setupGlobalEnhancers();
        await this.registerRoutes();
        await this.callLifecycleHooks('onModuleInit');
        await this.callLifecycleHooks('onApplicationBootstrap');

        this.isInitialized = true;
        return this;
    }

    /**
     * Get the exported fetch handler for Cloudflare Workers
     */
    getHandler(): ExportedHandler {
        return {
            fetch: this.handleRequest.bind(this),
        };
    }

    /**
     * Create a custom fetch handler
     */
    createFetchHandler(): (
        request: Request,
        env: unknown,
        ctx: ExecutionContext
    ) => Promise<Response> {
        return this.handleRequest.bind(this);
    }

    /**
     * Set global prefix for all routes
     */
    setGlobalPrefix(prefix: string): this {
        (this.options as { globalPrefix: string }).globalPrefix = prefix;
        return this;
    }

    /**
     * Use global guards
     */
    useGlobalGuards(...guards: Array<Type<Guard> | Guard>): this {
        for (const guard of guards) {
            const instance = this.resolveEnhancer(guard) as Guard;
            this.globalGuards.push(instance);
        }
        return this;
    }

    /**
     * Use global interceptors
     */
    useGlobalInterceptors(...interceptors: Array<Type<Interceptor> | Interceptor>): this {
        for (const interceptor of interceptors) {
            const instance = this.resolveEnhancer(interceptor) as Interceptor;
            this.globalInterceptors.push(instance);
        }
        return this;
    }

    /**
     * Use global pipes
     */
    useGlobalPipes(...pipes: Array<Type<PipeTransform> | PipeTransform>): this {
        for (const pipe of pipes) {
            const instance = this.resolveEnhancer(pipe) as PipeTransform;
            this.globalPipes.push(instance);
        }
        return this;
    }

    /**
     * Use global exception filters
     */
    useGlobalFilters(...filters: Array<Type<ExceptionFilter> | ExceptionFilter>): this {
        for (const filter of filters) {
            const instance = this.resolveEnhancer(filter) as ExceptionFilter;
            this.globalFilters.push(instance);
        }
        return this;
    }

    /**
     * Enable CORS
     */
    enableCors(options?: CorsOptions): this {
        (this.options as { cors: boolean | CorsOptions }).cors = options ?? true;
        return this;
    }

    /**
     * Get the DI container
     */
    get<T>(token: Type<T> | string | symbol): T {
        return this.container.resolve(token as Type<T>);
    }

    // request handling. i spent way too much time here.

    private async handleRequest(
        request: Request,
        env: unknown,
        ctx: ExecutionContext
    ): Promise<Response> {
        // Lazy init
        if (!this.isInitialized) {
            await this.init();
        }

        try {
            if (this.options.cors && request.method === 'OPTIONS') {
                return this.handleCors(request, new Response(null, { status: 204 }));
            }
            const url = new URL(request.url);
            let path = url.pathname;

            if (this.options.globalPrefix && path.startsWith(this.options.globalPrefix)) {
                path = path.slice(this.options.globalPrefix.length) || '/';
            }
            const match = this.router.match(request.method as HttpMethod, path);

            if (!match) {
                throw new NotFoundException(`Cannot ${request.method} ${path}`);
            }

            const execContext = new FlareoneExecutionContext(
                request,
                env,
                ctx,
                match.handler,
                match.params
            );

            const response = await this.executePipeline(execContext, match.handler);

            if (this.options.cors) {
                return this.handleCors(request, response);
            }

            return response;
        } catch (error) {
            return this.handleException(error, request, env, ctx);
        }
    }

    private async executePipeline(
        context: FlareoneExecutionContext,
        handler: RouteHandler
    ): Promise<Response> {
        const guards = [
            ...this.globalGuards,
            ...handler.guards,
        ];

        for (const guard of guards) {
            const canActivate = await guard.canActivate(context);
            if (!canActivate) {
                throw new HttpException('Forbidden', 403);
            }
        }

        const interceptors = [
            ...this.globalInterceptors,
            ...handler.interceptors,
        ];

        let chainIndex = interceptors.length - 1;

        const buildChain = (): Promise<unknown> => {
            if (chainIndex < 0) {
                return this.executeHandler(context, handler);
            }

            const interceptor = interceptors[chainIndex--]!;
            const callHandler = new FlareoneCallHandler(buildChain);
            return Promise.resolve(interceptor.intercept(context, callHandler));
        };

        const result = await buildChain();

        return this.resultToResponse(result, handler);
    }

    private async executeHandler(
        context: FlareoneExecutionContext,
        handler: RouteHandler
    ): Promise<unknown> {
        const controller = handler.controller as Record<string, (...args: unknown[]) => unknown>;
        const method = controller[handler.methodName];

        if (!method) {
            throw new InternalServerErrorException(`Method ${handler.methodName} not found`);
        }

        const args = await this.resolveParameters(context, handler);

        const pipes = [
            ...this.globalPipes,
            ...handler.pipes,
        ];

        const transformedArgs = await Promise.all(
            args.map(async (arg, index) => {
                let value = arg;
                for (const pipe of pipes) {
                    value = await pipe.transform(value, {
                        type: 'custom',
                        name: String(index),
                    });
                }
                return value;
            })
        );

        return method.apply(controller, transformedArgs);
    }

    private async resolveParameters(
        context: FlareoneExecutionContext,
        handler: RouteHandler
    ): Promise<unknown[]> {
        const params = handler.params;
        const args: unknown[] = [];

        for (const param of params) {
            let value: unknown;

            switch (param.type) {
                case 'param':
                    value = param.name
                        ? context.getParam(param.name)
                        : context.getParams();
                    break;

                case 'query':
                    value = param.name
                        ? context.getQueryParam(param.name)
                        : Object.fromEntries(context.getQuery().entries());
                    break;

                case 'body':
                    const body = await context.getBody();
                    value = param.name && typeof body === 'object' && body
                        ? (body as Record<string, unknown>)[param.name]
                        : body;
                    break;

                case 'headers':
                    value = param.name
                        ? context.getHeader(param.name)
                        : Object.fromEntries(context.getHeaders().entries());
                    break;

                case 'request':
                    value = context.getRequest();
                    break;

                case 'response':
                    value = new ResponseBuilder();
                    break;

                case 'context':
                    value = context;
                    break;

                case 'env':
                    value = context.getEnv();
                    break;

                case 'custom':
                    if (param.data && typeof param.data === 'object') {
                        const { factory, factoryData } = param.data as {
                            factory: (data: unknown, ctx: FlareoneExecutionContext) => unknown;
                            factoryData: unknown;
                        };
                        if (factory) {
                            value = await factory(factoryData, context);
                        }
                    }
                    break;
            }

            if (param.pipes) {
                for (const pipe of param.pipes) {
                    const pipeInstance = typeof pipe === 'function'
                        ? this.container.resolve(pipe)
                        : pipe;
                    value = await (pipeInstance as PipeTransform).transform(value, {
                        type: param.type === 'body' ? 'body' : param.type === 'query' ? 'query' : 'param',
                        name: param.name,
                        data: param.data,
                    });
                }
            }

            args[param.index] = value;
        }

        return args;
    }

    private resultToResponse(result: unknown, handler: RouteHandler): Response {
        if (result instanceof Response) {
            return result;
        }

        const statusCode = handler.metadata.statusCode ?? 200;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...handler.metadata.headers,
        };

        if (result === null || result === undefined) {
            return new Response(null, { status: statusCode === 200 ? 204 : statusCode, headers });
        }
        if (typeof result === 'string') {
            headers['Content-Type'] = 'text/plain';
            return new Response(result, { status: statusCode, headers });
        }

        return new Response(JSON.stringify(result), {
            status: statusCode,
            headers,
        });
    }

    private async handleException(
        error: unknown,
        request: Request,
        env: unknown,
        ctx: ExecutionContext
    ): Promise<Response> {
        for (const filter of this.globalFilters) {
            try {
                const execContext = new FlareoneExecutionContext(
                    request,
                    env,
                    ctx,
                    { controller: {}, methodName: '', metadata: {} as RouteMetadata, guards: [], interceptors: [], pipes: [], params: [] },
                    {}
                );
                return await filter.catch(error, execContext);
            } catch {
                // idk
            }
        }

        const isDev = (env as Record<string, unknown>)?.['ENVIRONMENT'] === 'development';
        return errorToResponse(error, isDev);
    }

    private handleCors(request: Request, response: Response): Response {
        const corsOptions = typeof this.options.cors === 'object'
            ? this.options.cors
            : {};

        const origin = request.headers.get('Origin') ?? '*';
        const headers = new Headers(response.headers);

        const allowedOrigin = this.getAllowedOrigin(origin, corsOptions);
        if (allowedOrigin) {
            headers.set('Access-Control-Allow-Origin', allowedOrigin);
        }
        const methods = corsOptions.methods?.join(', ') ?? 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
        headers.set('Access-Control-Allow-Methods', methods);

        const allowedHeaders = corsOptions.allowedHeaders?.join(', ')
            ?? request.headers.get('Access-Control-Request-Headers')
            ?? '*';
        headers.set('Access-Control-Allow-Headers', allowedHeaders);
        if (corsOptions.credentials) {
            headers.set('Access-Control-Allow-Credentials', 'true');
        }

        if (corsOptions.exposedHeaders) {
            headers.set('Access-Control-Expose-Headers', corsOptions.exposedHeaders.join(', '));
        }
        if (corsOptions.maxAge) {
            headers.set('Access-Control-Max-Age', String(corsOptions.maxAge));
        }

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
        });
    }

    private getAllowedOrigin(origin: string, options: CorsOptions): string | null {
        if (options.origin === true || options.origin === undefined) {
            return origin;
        }
        if (options.origin === false) {
            return null;
        }
        if (typeof options.origin === 'string') {
            return options.origin;
        }
        if (Array.isArray(options.origin)) {
            return options.origin.includes(origin) ? origin : null;
        }
        if (typeof options.origin === 'function') {
            return options.origin(origin) ? origin : null;
        }
        return null;
    }

    // module processing - recursive hell

    private async processModule(moduleClass: Type | DynamicModule): Promise<void> {
        let module: Type;
        let dynamicProviders: Provider[] = [];
        if (isDynamicModule(moduleClass)) {
            module = moduleClass.module;
            dynamicProviders = moduleClass.providers ?? [];
        } else {
            module = moduleClass;
        }

        if (this.moduleInstances.has(module)) return;

        const moduleInstance = new module();
        this.moduleInstances.set(module, moduleInstance as object);

        const metadata = getModuleMetadata(module);

        const allProviders = [...(metadata.providers || []), ...dynamicProviders];
        for (const provider of allProviders) {
            this.container.register(provider);
        }

        for (const importedModule of metadata.imports ?? []) {
            if (importedModule instanceof Promise) {
                await this.processModule(await importedModule);
            } else {
                await this.processModule(importedModule);
            }
        }

        for (const controller of metadata.controllers ?? []) {
            this.container.register(controller);
            const instance = await this.container.resolveAsync(controller);
            this.controllerInstances.set(controller, instance as object);
        }
    }

    private async registerRoutes(): Promise<void> {
        for (const [controllerClass, instance] of this.controllerInstances) {
            const isController = getClassMetadata<boolean>(
                CONTROLLER_METADATA.IS_CONTROLLER,
                controllerClass
            );

            if (!isController) continue;

            const basePath = getClassMetadata<string>(CONTROLLER_METADATA.PATH, controllerClass) ?? '';
            const version = getClassMetadata<string>(CONTROLLER_METADATA.VERSION, controllerClass);

            const decoratedMethods = getDecoratedMethods(controllerClass.prototype);

            for (const methodName of decoratedMethods) {
                const routeMetadata = getMethodMetadata<RouteMetadata>(
                    '__route__',
                    controllerClass.prototype,
                    methodName
                );

                if (!routeMetadata) continue;

                let fullPath = '';
                if (this.options.globalPrefix) {
                    fullPath += this.options.globalPrefix;
                }
                if (version) {
                    fullPath += `/v${version}`;
                }
                if (basePath) {
                    fullPath += basePath.startsWith('/') ? basePath : `/${basePath}`;
                }
                if (routeMetadata.path) {
                    fullPath += routeMetadata.path.startsWith('/') ? routeMetadata.path : `/${routeMetadata.path}`;
                }
                if (!fullPath) {
                    fullPath = '/';
                }

                const guards = this.resolveEnhancers(
                    getGuards(controllerClass.prototype, methodName)
                ) as Guard[];

                const interceptors = this.resolveEnhancers(
                    getInterceptors(controllerClass.prototype, methodName)
                ) as Interceptor[];

                const pipes = this.resolveEnhancers(
                    getPipes(controllerClass.prototype, methodName)
                ) as PipeTransform[];

                const params = getParameterDecorators(controllerClass.prototype, methodName as string);

                const handler: RouteHandler = {
                    controller: instance,
                    methodName: String(methodName),
                    metadata: {
                        ...routeMetadata,
                        statusCode: getMethodMetadata(ROUTE_METADATA.STATUS_CODE, controllerClass.prototype, methodName),
                        headers: getMethodMetadata(ROUTE_METADATA.HEADERS, controllerClass.prototype, methodName),
                    },
                    guards,
                    interceptors,
                    pipes,
                    params,
                };

                this.router.register(routeMetadata.method, fullPath, handler);
            }
        }
    }

    private async setupGlobalEnhancers(): Promise<void> {
        if (this.options.guards) {
            for (const guard of this.options.guards) {
                const instance = this.resolveEnhancer(guard) as Guard;
                this.globalGuards.push(instance);
            }
        }

        if (this.options.interceptors) {
            for (const interceptor of this.options.interceptors) {
                const instance = this.resolveEnhancer(interceptor) as Interceptor;
                this.globalInterceptors.push(instance);
            }
        }

        if (this.options.pipes) {
            for (const pipe of this.options.pipes) {
                const instance = this.resolveEnhancer(pipe) as PipeTransform;
                this.globalPipes.push(instance);
            }
        }

        if (this.options.filters) {
            for (const filter of this.options.filters) {
                const instance = this.resolveEnhancer(filter) as ExceptionFilter;
                this.globalFilters.push(instance);
            }
        }
    }

    private resolveEnhancer<T>(enhancer: Type<T> | T): T {
        if (typeof enhancer === 'function') {
            try {
                return this.container.resolve(enhancer as Type<T>);
            } catch {
                return new (enhancer as Type<T>)();
            }
        }
        return enhancer;
    }

    private resolveEnhancers<T>(enhancers: Array<Type<T> | T>): T[] {
        return enhancers.map((e) => this.resolveEnhancer(e));
    }

    private async callLifecycleHooks(
        hook: 'onModuleInit' | 'onModuleDestroy' | 'onApplicationBootstrap'
    ): Promise<void> {
        for (const [, instance] of this.moduleInstances) {
            if (typeof (instance as any)[hook] === 'function') {
                await (instance as any)[hook]();
            }
        }

        for (const [, instance] of this.controllerInstances) {
            if (typeof (instance as any)[hook] === 'function') {
                await (instance as any)[hook]();
            }
        }
    }

    /**
     * Shutdown the application
     */
    async close(): Promise<void> {
        await this.callLifecycleHooks('onModuleDestroy');
        this.container.clear();
    }
}

class ResponseBuilder {
    private _status: number = 200;
    private _headers: Record<string, string> = {};

    status(code: number): this {
        this._status = code;
        return this;
    }

    header(name: string, value: string): this {
        this._headers[name] = value;
        return this;
    }

    json(data: unknown): Response {
        return new Response(JSON.stringify(data), {
            status: this._status,
            headers: {
                'Content-Type': 'application/json',
                ...this._headers,
            },
        });
    }

    text(data: string): Response {
        return new Response(data, {
            status: this._status,
            headers: {
                'Content-Type': 'text/plain',
                ...this._headers,
            },
        });
    }

    html(data: string): Response {
        return new Response(data, {
            status: this._status,
            headers: {
                'Content-Type': 'text/html',
                ...this._headers,
            },
        });
    }

    redirect(url: string, status: number = 302): Response {
        return Response.redirect(url, status);
    }
}

/**
 * Create a new Flareone application
 */
export class FlareoneFactory {
    /**
     * Create a new application instance
     */
    static async create(
        rootModule: Type,
        options?: FlareoneApplicationOptions
    ): Promise<FlareoneApplication> {
        const app = new FlareoneApplication(rootModule, options);
        await app.init();
        return app;
    }

    /**
     * Create an application without initializing
     * Useful for lazy initialization
     */
    static createDeferred(
        rootModule: Type,
        options?: FlareoneApplicationOptions
    ): FlareoneApplication {
        return new FlareoneApplication(rootModule, options);
    }
}
