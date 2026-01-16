/**
 * DI Decorators
 * tell the container how to build stuff.
 */

import { INJECTABLE_METADATA, SCOPE, type ProviderScope } from '../constants.js';
import {
    defineClassMetadata,
    defineParameterMetadata,
    getClassMetadata,
} from '../metadata.js';
import type {
    Type,
    InjectionToken,
    ForwardRef,
} from '../types.js';

export interface InjectableOptions {
    scope?: ProviderScope;
    providedIn?: 'root' | Type;
}

export function Injectable(options: InjectableOptions = {}): ClassDecorator {
    return (target) => {
        defineClassMetadata(INJECTABLE_METADATA.IS_INJECTABLE, true, target);
        defineClassMetadata(INJECTABLE_METADATA.SCOPE, options.scope ?? SCOPE.SINGLETON, target);

        if (options.providedIn) {
            defineClassMetadata(`${INJECTABLE_METADATA.TOKEN}:providedIn`, options.providedIn, target);
        }

        return target;
    };
}

export interface InjectDecoratorOptions {
    optional?: boolean;
}

export function Inject(
    token: InjectionToken | ForwardRef,
    options: InjectDecoratorOptions = {}
): ParameterDecorator {
    return (target, propertyKey, parameterIndex) => {
        const deps = getClassMetadata<Array<InjectionToken | ForwardRef>>(
            INJECTABLE_METADATA.DEPENDENCIES,
            target
        ) ?? [];

        while (deps.length <= parameterIndex) {
            deps.push(undefined as unknown as InjectionToken);
        }

        deps[parameterIndex] = token;
        defineClassMetadata(INJECTABLE_METADATA.DEPENDENCIES, deps, target);

        if (options.optional) {
            defineParameterMetadata(
                `${INJECTABLE_METADATA.TOKEN}:optional`,
                true,
                target,
                propertyKey,
                parameterIndex
            );
        }
    };
}

/**
 * Mark a dependency as optional
 */
export function Optional(): ParameterDecorator {
    return (target, propertyKey, parameterIndex) => {
        defineParameterMetadata(
            `${INJECTABLE_METADATA.TOKEN}:optional`,
            true,
            target,
            propertyKey,
            parameterIndex
        );
    };
}

/**
 * Register dependencies for a class (use when constructor parameter decorators aren't sufficient)
 */
export function Dependencies(...tokens: InjectionToken[]): ClassDecorator {
    return (target) => {
        defineClassMetadata(INJECTABLE_METADATA.DEPENDENCIES, tokens, target);
        return target;
    };
}

/**
 * Mark a service as singleton (default behavior)
 */
export function Singleton(): ClassDecorator {
    return (target) => {
        defineClassMetadata(INJECTABLE_METADATA.SCOPE, SCOPE.SINGLETON, target);
        return target;
    };
}

/**
 * Mark a service as request-scoped
 */
export function RequestScoped(): ClassDecorator {
    return (target) => {
        defineClassMetadata(INJECTABLE_METADATA.SCOPE, SCOPE.REQUEST, target);
        return target;
    };
}

/**
 * Mark a service as transient (new instance every injection)
 */
export function Transient(): ClassDecorator {
    return (target) => {
        defineClassMetadata(INJECTABLE_METADATA.SCOPE, SCOPE.TRANSIENT, target);
        return target;
    };
}

type ClassDecorator = <T extends Type>(target: T) => T | void;
type ParameterDecorator = (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
) => void;
