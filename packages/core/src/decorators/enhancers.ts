/**
 * Enhancers
 * guards, interceptors, pipes, filters. the "plumbing".
 */

import {
    GUARD_METADATA,
    INTERCEPTOR_METADATA,
    PIPE_METADATA,
    FILTER_METADATA,
} from '../constants.js';
import {
    defineClassMetadata,
    defineMethodMetadata,
    appendClassMetadata,
    appendMethodMetadata,
    getClassMetadata,
    getMethodMetadata,
} from '../metadata.js';
import type {
    Type,
    Guard,
    Interceptor,
    PipeTransform,
    ExceptionFilter,
} from '../types.js';

type ClassDecorator = <T extends Type>(target: T) => T | void;
type MethodDecorator = <T>(
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>
) => TypedPropertyDescriptor<T> | void;

/**
 * Apply guards to a controller or route handler
 * Guards are executed before the route handler
 */
export function UseGuards(
    ...guards: Array<Type<Guard> | Guard>
): ClassDecorator & MethodDecorator {
    return ((
        targetOrPrototype: object,
        propertyKey?: string | symbol,
        descriptor?: PropertyDescriptor
    ) => {
        if (propertyKey !== undefined && descriptor) {
            for (const guard of guards) {
                appendMethodMetadata(GUARD_METADATA.GUARDS, guard, targetOrPrototype, propertyKey);
            }
            return descriptor;
        } else {
            for (const guard of guards) {
                appendClassMetadata(GUARD_METADATA.GUARDS, guard, targetOrPrototype);
            }
            return targetOrPrototype;
        }
    }) as ClassDecorator & MethodDecorator;
}

/**
 * Get guards for a controller or method
 */
export function getGuards(target: object, propertyKey?: string | symbol): Array<Type<Guard> | Guard> {
    const classGuards = getClassMetadata<Array<Type<Guard> | Guard>>(GUARD_METADATA.GUARDS, target.constructor) ?? [];

    if (propertyKey) {
        const methodGuards = getMethodMetadata<Array<Type<Guard> | Guard>>(
            GUARD_METADATA.GUARDS,
            target,
            propertyKey
        ) ?? [];
        return [...classGuards, ...methodGuards];
    }

    return classGuards;
}

/**
 * Apply interceptors to a controller or route handler
 * Interceptors can transform the request/response
 */
export function UseInterceptors(
    ...interceptors: Array<Type<Interceptor> | Interceptor>
): ClassDecorator & MethodDecorator {
    return ((
        targetOrPrototype: object,
        propertyKey?: string | symbol,
        descriptor?: PropertyDescriptor
    ) => {
        if (propertyKey !== undefined && descriptor) {
            for (const interceptor of interceptors) {
                appendMethodMetadata(INTERCEPTOR_METADATA.INTERCEPTORS, interceptor, targetOrPrototype, propertyKey);
            }
            return descriptor;
        } else {
            for (const interceptor of interceptors) {
                appendClassMetadata(INTERCEPTOR_METADATA.INTERCEPTORS, interceptor, targetOrPrototype);
            }
            return targetOrPrototype;
        }
    }) as ClassDecorator & MethodDecorator;
}

/**
 * Get interceptors for a controller or method
 */
export function getInterceptors(
    target: object,
    propertyKey?: string | symbol
): Array<Type<Interceptor> | Interceptor> {
    const classInterceptors = getClassMetadata<Array<Type<Interceptor> | Interceptor>>(
        INTERCEPTOR_METADATA.INTERCEPTORS,
        target.constructor
    ) ?? [];

    if (propertyKey) {
        const methodInterceptors = getMethodMetadata<Array<Type<Interceptor> | Interceptor>>(
            INTERCEPTOR_METADATA.INTERCEPTORS,
            target,
            propertyKey
        ) ?? [];
        return [...classInterceptors, ...methodInterceptors];
    }

    return classInterceptors;
}

/**
 * Apply pipes to a controller, route handler, or parameter
 * Pipes transform and validate input data
 */
export function UsePipes(
    ...pipes: Array<Type<PipeTransform> | PipeTransform>
): ClassDecorator & MethodDecorator {
    return ((
        targetOrPrototype: object,
        propertyKey?: string | symbol,
        descriptor?: PropertyDescriptor
    ) => {
        if (propertyKey !== undefined && descriptor) {
            for (const pipe of pipes) {
                appendMethodMetadata(PIPE_METADATA.PIPES, pipe, targetOrPrototype, propertyKey);
            }
            return descriptor;
        } else {
            for (const pipe of pipes) {
                appendClassMetadata(PIPE_METADATA.PIPES, pipe, targetOrPrototype);
            }
            return targetOrPrototype;
        }
    }) as ClassDecorator & MethodDecorator;
}

/**
 * Get pipes for a controller or method
 */
export function getPipes(
    target: object,
    propertyKey?: string | symbol
): Array<Type<PipeTransform> | PipeTransform> {
    const classPipes = getClassMetadata<Array<Type<PipeTransform> | PipeTransform>>(
        PIPE_METADATA.PIPES,
        target.constructor
    ) ?? [];

    if (propertyKey) {
        const methodPipes = getMethodMetadata<Array<Type<PipeTransform> | PipeTransform>>(
            PIPE_METADATA.PIPES,
            target,
            propertyKey
        ) ?? [];
        return [...classPipes, ...methodPipes];
    }

    return classPipes;
}

/**
 * Apply exception filters to a controller or route handler
 */
export function UseFilters(
    ...filters: Array<Type<ExceptionFilter> | ExceptionFilter>
): ClassDecorator & MethodDecorator {
    return ((
        targetOrPrototype: object,
        propertyKey?: string | symbol,
        descriptor?: PropertyDescriptor
    ) => {
        if (propertyKey !== undefined && descriptor) {
            for (const filter of filters) {
                appendMethodMetadata(FILTER_METADATA.FILTERS, filter, targetOrPrototype, propertyKey);
            }
            return descriptor;
        } else {
            for (const filter of filters) {
                appendClassMetadata(FILTER_METADATA.FILTERS, filter, targetOrPrototype);
            }
            return targetOrPrototype;
        }
    }) as ClassDecorator & MethodDecorator;
}

/**
 * Mark an exception filter to catch specific exception types
 */
export function Catch(...exceptions: Type<Error>[]): ClassDecorator {
    return (target) => {
        defineClassMetadata(FILTER_METADATA.CATCH, exceptions, target);
        defineClassMetadata(FILTER_METADATA.IS_FILTER, true, target);
        return target;
    };
}

/**
 * Get filters for a controller or method
 */
export function getFilters(
    target: object,
    propertyKey?: string | symbol
): Array<Type<ExceptionFilter> | ExceptionFilter> {
    const classFilters = getClassMetadata<Array<Type<ExceptionFilter> | ExceptionFilter>>(
        FILTER_METADATA.FILTERS,
        target.constructor
    ) ?? [];

    if (propertyKey) {
        const methodFilters = getMethodMetadata<Array<Type<ExceptionFilter> | ExceptionFilter>>(
            FILTER_METADATA.FILTERS,
            target,
            propertyKey
        ) ?? [];
        return [...classFilters, ...methodFilters];
    }

    return classFilters;
}

/**
 * Get caught exception types for a filter
 */
export function getCaughtExceptions(filterClass: Type): Type<Error>[] {
    return getClassMetadata<Type<Error>[]>(FILTER_METADATA.CATCH, filterClass) ?? [];
}

/**
 * Add custom metadata to a class or method
 */
export function SetMetadata<K extends string, V>(
    key: K,
    value: V
): ClassDecorator & MethodDecorator {
    return ((
        targetOrPrototype: object,
        propertyKey?: string | symbol,
        descriptor?: PropertyDescriptor
    ) => {
        if (propertyKey !== undefined && descriptor) {
            defineMethodMetadata(key, value, targetOrPrototype, propertyKey);
            return descriptor;
        } else {
            defineClassMetadata(key, value, targetOrPrototype);
            return targetOrPrototype;
        }
    }) as ClassDecorator & MethodDecorator;
}

/**
 * Mark a route as public (no authentication required)
 */
export function Public(): MethodDecorator {
    return SetMetadata('isPublic', true) as MethodDecorator;
}

/**
 * Require specific roles for a route
 */
export function Roles(...roles: string[]): MethodDecorator {
    return SetMetadata('roles', roles) as MethodDecorator;
}

/**
 * Apply rate limiting to a route
 */
export function Throttle(options: { limit: number; ttl: number }): MethodDecorator {
    return SetMetadata('throttle', options) as MethodDecorator;
}

/**
 * Skip rate limiting for a route
 */
export function SkipThrottle(): MethodDecorator {
    return SetMetadata('skipThrottle', true) as MethodDecorator;
}
