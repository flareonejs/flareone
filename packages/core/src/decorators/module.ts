/**
 * Module Decorators
 * groups everything together.
 */

import { MODULE_METADATA } from '../constants.js';
import { defineClassMetadata, getClassMetadata } from '../metadata.js';
import type { Type, ModuleMetadata, DynamicModule, Provider, InjectionToken } from '../types.js';

type ClassDecorator = <T extends Type>(target: T) => T | void;

/**
 * Mark a class as a module
 */
export function Module(metadata: ModuleMetadata): ClassDecorator {
    return (target) => {
        defineClassMetadata(MODULE_METADATA.IMPORTS, metadata.imports ?? [], target);
        defineClassMetadata(MODULE_METADATA.CONTROLLERS, metadata.controllers ?? [], target);
        defineClassMetadata(MODULE_METADATA.PROVIDERS, metadata.providers ?? [], target);
        defineClassMetadata(MODULE_METADATA.EXPORTS, metadata.exports ?? [], target);
        return target;
    };
}

/**
 * Mark a module as global
 * Global modules don't need to be imported in other modules
 */
export function Global(): ClassDecorator {
    return (target) => {
        defineClassMetadata(MODULE_METADATA.IS_GLOBAL, true, target);
        return target;
    };
}

/**
 * Get module metadata
 */
export function getModuleMetadata(moduleClass: Type): ModuleMetadata {
    return {
        imports: getClassMetadata<Type[]>(MODULE_METADATA.IMPORTS, moduleClass) ?? [],
        controllers: getClassMetadata<Type[]>(MODULE_METADATA.CONTROLLERS, moduleClass) ?? [],
        providers: getClassMetadata<Provider[]>(MODULE_METADATA.PROVIDERS, moduleClass) ?? [],
        exports: getClassMetadata<Array<InjectionToken | Provider>>(MODULE_METADATA.EXPORTS, moduleClass) ?? [],
    };
}

/**
 * Check if a module is global
 */
export function isGlobalModule(moduleClass: Type): boolean {
    return getClassMetadata<boolean>(MODULE_METADATA.IS_GLOBAL, moduleClass) ?? false;
}

/**
 * Check if a module is dynamic
 */
export function isDynamicModule(module: Type | DynamicModule): module is DynamicModule {
    return (module as DynamicModule).module !== undefined;
}

export interface ConfigurableModuleOptions {
    forRootMethodName?: string;
    forRootAsyncMethodName?: string;
    forFeatureMethodName?: string;
}

/**
 * Factory for creating configurable modules
 */
export interface ConfigurableModuleFactory<TOptions = unknown> {
    forRoot(options: TOptions): DynamicModule;
    forRootAsync(asyncOptions: AsyncModuleOptions<TOptions>): DynamicModule;
    forFeature(options?: Partial<TOptions>): DynamicModule;
}

/**
 * Async module configuration options
 */
export interface AsyncModuleOptions<T> {
    useFactory: (...args: unknown[]) => T | Promise<T>;
    inject?: InjectionToken[];
    imports?: Array<Type | DynamicModule>;
}

/**
 * Create an options token for a module
 */
export function createOptionsToken(moduleName: string): symbol {
    return Symbol.for(`${moduleName}_MODULE_OPTIONS`);
}
