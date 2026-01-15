/**
 * DI Container
 * 
 * i tried to keep it simple but it grew. 
 * resolved everything without reflect-metadata (mostly).
 */

import { INJECTABLE_METADATA, SCOPE, type ProviderScope } from '../constants.js';
import { getClassMetadata, getParameterMetadata, getParameterIndices } from '../metadata.js';
import type {
    Type,
    InjectionToken,
    Provider,
    ClassProvider,
    ValueProvider,
    FactoryProvider,
    ExistingProvider,
} from '../types.js';
import {
    isClassProvider as checkClassProvider,
    isValueProvider as checkValueProvider,
    isFactoryProvider as checkFactoryProvider,
    isExistingProvider as checkExistingProvider,
    isTypeProvider as checkTypeProvider,
} from '../types.js';

interface ProviderRecord<T = unknown> {
    token: InjectionToken<T>;
    scope: ProviderScope;
    factory: (container: Container, requestScope?: Map<InjectionToken, unknown>) => T | Promise<T>;
    instance?: T;
    isResolved: boolean;
}

export interface InjectOptions {
    optional?: boolean;
}

// Errors. you'll see these a lot if you have circular deps.

export class ContainerError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ContainerError';
    }
}

export class CircularDependencyError extends ContainerError {
    constructor(tokens: InjectionToken[]) {
        const path = tokens.map((t) => getTokenName(t)).join(' -> ');
        super(`Circular dependency detected: ${path}`);
        this.name = 'CircularDependencyError';
    }
}

export class TokenNotFoundError extends ContainerError {
    constructor(token: InjectionToken) {
        super(`No provider found for token: ${getTokenName(token)}`);
        this.name = 'TokenNotFoundError';
    }
}

/**
 * Get a human-readable name for an injection token
 */
export function getTokenName(token: InjectionToken): string {
    if (typeof token === 'function') {
        return token.name || 'Anonymous';
    }
    if (typeof token === 'symbol') {
        return token.toString();
    }
    return String(token);
}

/**
 * Get the token from a provider
 */
function getProviderToken<T>(provider: Provider<T>): InjectionToken<T> {
    if (checkTypeProvider(provider)) {
        return provider;
    }
    return (provider as ClassProvider<T> | ValueProvider<T> | FactoryProvider<T> | ExistingProvider<T>).provide;
}

// The actual Container. Good luck.

export class Container {
    private readonly providers = new Map<InjectionToken, ProviderRecord>();
    private parent?: Container;
    private resolutionStack: InjectionToken[] = [];
    private scopedInstances = new Map<InjectionToken, unknown>();

    constructor(parent?: Container) {
        this.parent = parent;

        this.providers.set(Container as unknown as InjectionToken, {
            token: Container as unknown as InjectionToken,
            scope: SCOPE.SINGLETON,
            factory: () => this,
            instance: this,
            isResolved: true,
        });
    }

    /**
     * Register a provider
     */
    register<T>(provider: Provider<T>): this {
        const token = getProviderToken(provider);
        const record = this.createProviderRecord(provider);
        this.providers.set(token, record);
        return this;
    }

    /**
     * Register multiple providers
     */
    registerMany(providers: Provider[]): this {
        for (const provider of providers) {
            this.register(provider);
        }
        return this;
    }

    /**
     * Register a class provider
     */
    registerClass<T>(
        token: InjectionToken<T>,
        cls: Type<T>,
        scope: ProviderScope = SCOPE.SINGLETON
    ): this {
        return this.register({
            provide: token,
            useClass: cls,
            scope,
        });
    }

    /**
     * Register a value provider
     */
    registerValue<T>(token: InjectionToken<T>, value: T): this {
        return this.register({
            provide: token,
            useValue: value,
        });
    }

    /**
     * Register a factory provider
     */
    registerFactory<T>(
        token: InjectionToken<T>,
        factory: (...args: unknown[]) => T | Promise<T>,
        inject?: InjectionToken[],
        scope: ProviderScope = SCOPE.SINGLETON
    ): this {
        return this.register({
            provide: token,
            useFactory: factory,
            inject,
            scope,
        });
    }

    /**
     * Register an alias to existing provider
     */
    registerAlias<T>(token: InjectionToken<T>, existing: InjectionToken<T>): this {
        return this.register({
            provide: token,
            useExisting: existing,
        });
    }

    /**
     * Resolve a provider and return the instance
     */
    resolve<T>(token: InjectionToken<T>, options?: InjectOptions): T {
        const result = this.resolveInternal(token, options);
        if (result instanceof Promise) {
            throw new ContainerError(
                `Cannot use resolve() for async provider ${getTokenName(token)}. Use resolveAsync() instead.`
            );
        }
        return result;
    }

    /**
     * Resolve a provider asynchronously
     */
    async resolveAsync<T>(token: InjectionToken<T>, options?: InjectOptions): Promise<T> {
        return this.resolveInternal(token, options);
    }

    /**
     * Resolve multiple providers
     */
    resolveAll<T extends readonly InjectionToken[]>(
        tokens: [...T]
    ): { [K in keyof T]: T[K] extends InjectionToken<infer U> ? U : never } {
        return tokens.map((token) => this.resolve(token)) as any;
    }

    /**
     * Check if a provider is registered
     */
    has(token: InjectionToken): boolean {
        return this.providers.has(token) || (this.parent?.has(token) ?? false);
    }

    /**
     * Create a child container
     */
    createChild(): Container {
        return new Container(this);
    }

    /**
     * Create a request-scoped container
     */
    createRequestScope(): Container {
        const child = this.createChild();
        child.scopedInstances = new Map();
        return child;
    }

    private resolveInternal<T>(
        token: InjectionToken<T>,
        options?: InjectOptions
    ): T | Promise<T> {
        if (this.resolutionStack.includes(token)) {
            throw new CircularDependencyError([...this.resolutionStack, token]);
        }
        const record = this.getProviderRecord<T>(token);

        if (!record) {
            if (options?.optional) {
                return undefined as T;
            }
            throw new TokenNotFoundError(token);
        }

        switch (record.scope) {
            case SCOPE.SINGLETON:
                return this.resolveSingleton(token, record);

            case SCOPE.REQUEST:
                return this.resolveRequestScoped(token, record);

            case SCOPE.TRANSIENT:
                return this.resolveTransient(record);

            default:
                return this.resolveSingleton(token, record);
        }
    }

    private resolveSingleton<T>(
        token: InjectionToken<T>,
        record: ProviderRecord<T>
    ): T | Promise<T> {
        if (record.isResolved && record.instance !== undefined) {
            return record.instance;
        }
        this.resolutionStack.push(token);

        try {
            const instance = record.factory(this);

            if (instance instanceof Promise) {
                return instance.then((resolved) => {
                    record.instance = resolved;
                    record.isResolved = true;
                    return resolved;
                });
            }

            record.instance = instance;
            record.isResolved = true;
            return instance;
        } finally {
            this.resolutionStack.pop();
        }
    }

    private resolveRequestScoped<T>(
        token: InjectionToken<T>,
        record: ProviderRecord<T>
    ): T | Promise<T> {
        if (this.scopedInstances.has(token)) {
            return this.scopedInstances.get(token) as T;
        }
        this.resolutionStack.push(token);

        try {
            const instance = record.factory(this);

            if (instance instanceof Promise) {
                return instance.then((resolved) => {
                    this.scopedInstances.set(token, resolved);
                    return resolved;
                });
            }

            this.scopedInstances.set(token, instance);
            return instance;
        } finally {
            this.resolutionStack.pop();
        }
    }

    private resolveTransient<T>(record: ProviderRecord<T>): T | Promise<T> {
        return record.factory(this);
    }

    private getProviderRecord<T>(token: InjectionToken<T>): ProviderRecord<T> | undefined {
        const record = this.providers.get(token) as ProviderRecord<T> | undefined;
        if (record) return record;
        return this.parent?.getProviderRecord(token);
    }

    private createProviderRecord<T>(provider: Provider<T>): ProviderRecord<T> {
        const token = getProviderToken(provider);

        if (checkTypeProvider(provider)) {
            const scope = getClassMetadata<ProviderScope>(INJECTABLE_METADATA.SCOPE, provider) ?? SCOPE.SINGLETON;
            return {
                token,
                scope,
                factory: (container) => this.instantiateClass(provider, container),
                isResolved: false,
            };
        }

        if (checkClassProvider(provider)) {
            return {
                token,
                scope: provider.scope ?? SCOPE.SINGLETON,
                factory: (container) => this.instantiateClass(provider.useClass, container),
                isResolved: false,
            };
        }

        if (checkValueProvider(provider)) {
            return {
                token,
                scope: SCOPE.SINGLETON,
                factory: () => provider.useValue,
                instance: provider.useValue,
                isResolved: true,
            };
        }

        if (checkFactoryProvider(provider)) {
            return {
                token,
                scope: provider.scope ?? SCOPE.SINGLETON,
                factory: (container) => {
                    const deps = (provider.inject ?? []).map((dep) => container.resolve(dep));
                    return provider.useFactory(...deps);
                },
                isResolved: false,
            };
        }

        if (checkExistingProvider(provider)) {
            return {
                token,
                scope: SCOPE.SINGLETON,
                factory: (container) => container.resolve(provider.useExisting),
                isResolved: false,
            };
        }

        throw new ContainerError(`Invalid provider: ${JSON.stringify(provider)}`);
    }

    private instantiateClass<T>(cls: Type<T>, container: Container): T {
        const dependencies = this.getConstructorDependencies(cls);
        const args = dependencies.map(({ token, optional }) =>
            container.resolveInternal(token, { optional })
        );
        const hasAsync = args.some((arg) => arg instanceof Promise);

        if (hasAsync) {
            return Promise.all(args).then((resolvedArgs) =>
                new cls(...resolvedArgs)
            ) as unknown as T;
        }

        if (args.length < cls.length) {
            console.warn(`[Flareone] Warning: Class ${cls.name} expects ${cls.length} arguments but ${args.length} were resolved. Ensure @Inject() is used or reflect-metadata is imported.`);
        }

        return new cls(...args);
    }

    private getConstructorDependencies(cls: Type): Array<{ token: InjectionToken; optional: boolean }> {
        const registeredDeps = getClassMetadata<InjectionToken[]>(
            INJECTABLE_METADATA.DEPENDENCIES,
            cls
        ) ?? [];

        let implicitTypes: InjectionToken[] = [];
        try {
            if (typeof Reflect !== 'undefined' && 'getMetadata' in Reflect) {
                implicitTypes = (Reflect as any).getMetadata('design:paramtypes', cls) || [];
            }
        } catch { }

        const paramIndices = getParameterIndices(cls, undefined);

        const dependencies: Array<{ token: InjectionToken; optional: boolean }> = [];
        const length = Math.max(registeredDeps.length, implicitTypes.length, ...paramIndices, cls.length || 0);

        for (let i = 0; i < length; i++) {
            let token = registeredDeps[i];

            if (!token && implicitTypes[i]) {
                token = implicitTypes[i];
            }

            const optional = getParameterMetadata<boolean>(
                `${INJECTABLE_METADATA.TOKEN}:optional`,
                cls,
                undefined,
                i
            ) ?? false;

            // If token is missing, we still push it (undefined) to maintain index alignment
            // The container will fail to resolve undefined, which is expected or can be caught
            dependencies.push({ token: token as InjectionToken, optional });
        }

        return dependencies;
    }

    /**
     * Clear all cached instances (useful for testing)
     */
    clear(): void {
        for (const record of this.providers.values()) {
            if (record.token !== Container) {
                record.instance = undefined;
                record.isResolved = false;
            }
        }
        this.scopedInstances.clear();
    }

    /**
     * Get all registered tokens
     */
    getRegisteredTokens(): InjectionToken[] {
        return Array.from(this.providers.keys());
    }
}

let globalContainer: Container | null = null;

/**
 * Get the global container instance
 */
export function getGlobalContainer(): Container {
    if (!globalContainer) {
        globalContainer = new Container();
    }
    return globalContainer;
}

/**
 * Reset the global container (for testing)
 */
export function resetGlobalContainer(): void {
    globalContainer = null;
}
