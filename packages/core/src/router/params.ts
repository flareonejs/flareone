/**
 * Parameter Decorators
 * for when you need to grab stuff from the request.
 */

import { PARAM_METADATA } from '../constants.js';
import { defineParameterMetadata, getParameterMetadata, getAllParameterMetadata } from '../metadata.js';
import type { ParameterMetadata, PipeTransform, Type } from '../types.js';

type ParameterDecorator = (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
) => void;

function createParamDecorator(
    type: ParameterMetadata['type'],
    dataFactory?: (data: unknown) => unknown
) {
    return function (
        data?: unknown,
        ...pipes: Array<Type<PipeTransform> | PipeTransform>
    ): ParameterDecorator {
        return (target, propertyKey, parameterIndex) => {
            const metadata: ParameterMetadata = {
                index: parameterIndex,
                type,
                name: typeof data === 'string' ? data : undefined,
                data: dataFactory ? dataFactory(data) : data,
                pipes: pipes.length > 0 ? pipes as PipeTransform[] : undefined,
            };

            const key = propertyKey ?? '__constructor__';
            const existing = getAllParameterMetadata(target, key);
            const params: Map<number, ParameterMetadata> = existing
                ? new Map(Array.from(existing.entries()).map(([idx, _]) => [
                    idx,
                    getParameterMetadata<ParameterMetadata>(PARAM_METADATA.CUSTOM, target, key, idx) ??
                    { index: idx, type: 'custom' }
                ]))
                : new Map();

            params.set(parameterIndex, metadata);

            defineParameterMetadata(PARAM_METADATA.CUSTOM, metadata, target, propertyKey, parameterIndex);
        };
    };
}

export function getParameterDecorators(
    target: object,
    propertyKey: string | symbol
): ParameterMetadata[] {
    const metadata: ParameterMetadata[] = [];
    const paramsMap = getAllParameterMetadata(target, propertyKey);

    if (paramsMap) {
        for (const [index] of paramsMap) {
            const param = getParameterMetadata<ParameterMetadata>(
                PARAM_METADATA.CUSTOM,
                target,
                propertyKey,
                index
            );
            if (param) {
                metadata.push(param);
            }
        }
    }

    return metadata.sort((a, b) => a.index - b.index);
}

/**
 * Extract route parameters
 */
export function Param(): ParameterDecorator;
export function Param(property: string, ...pipes: Array<Type<PipeTransform> | PipeTransform>): ParameterDecorator;
export function Param(
    property?: string,
    ...pipes: Array<Type<PipeTransform> | PipeTransform>
): ParameterDecorator {
    return createParamDecorator('param')(property, ...pipes);
}

/**
 * Extract query parameters
 */
export function Query(): ParameterDecorator;
export function Query(property: string, ...pipes: Array<Type<PipeTransform> | PipeTransform>): ParameterDecorator;
export function Query(
    property?: string,
    ...pipes: Array<Type<PipeTransform> | PipeTransform>
): ParameterDecorator {
    return createParamDecorator('query')(property, ...pipes);
}

/**
 * Extract request body
 */
export function Body(): ParameterDecorator;
export function Body(property: string, ...pipes: Array<Type<PipeTransform> | PipeTransform>): ParameterDecorator;
export function Body(
    property?: string,
    ...pipes: Array<Type<PipeTransform> | PipeTransform>
): ParameterDecorator {
    return createParamDecorator('body')(property, ...pipes);
}

/**
 * Extract request headers
 */
export function Headers(): ParameterDecorator;
export function Headers(property: string): ParameterDecorator;
export function Headers(property?: string): ParameterDecorator {
    return createParamDecorator('headers')(property);
}

/**
 * Get the raw Request object
 */
export function Req(): ParameterDecorator {
    return createParamDecorator('request')();
}

/** 
 * Alias for Req
 */
export const Request = Req;

/**
 * Get a Response builder (for custom responses)
 */
export function Res(): ParameterDecorator {
    return createParamDecorator('response')();
}

/** Alias for Res */
export const Response = Res;

/**
 * Get the execution context wrapper
 */
export function Ctx(): ParameterDecorator {
    return createParamDecorator('context')();
}

/** 
 * Alias for Ctx
 */
export const Context = Ctx;

/**
 * Get the Cloudflare environment bindings
 */
export function Env(): ParameterDecorator {
    return createParamDecorator('env')();
}

export type CustomParamFactory<TData = unknown, TContext = unknown, TResult = unknown> = (
    data: TData,
    context: TContext
) => TResult | Promise<TResult>;

/**
 * Create a custom parameter decorator
 */
export function createParamDecoratorFactory<TData = unknown, TContext = unknown, TResult = unknown>(
    factory: CustomParamFactory<TData, TContext, TResult>
): (data?: TData) => ParameterDecorator {
    return (data?: TData) => {
        return (target, propertyKey, parameterIndex) => {
            const metadata: ParameterMetadata = {
                index: parameterIndex,
                type: 'custom',
                data: { factory, factoryData: data },
            };

            defineParameterMetadata(PARAM_METADATA.CUSTOM, metadata, target, propertyKey, parameterIndex);
        };
    };
}

/**
 * Get the client IP address
 */
export function Ip(): ParameterDecorator {
    return createParamDecoratorFactory<void, { getRequest: () => Request }, string | null>(
        (_, ctx) => {
            const request = ctx.getRequest();
            return (
                request.headers.get('cf-connecting-ip') ??
                request.headers.get('x-real-ip') ??
                request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
                null
            );
        }
    )();
}

/**
 * Get the User-Agent header
 */
export function UserAgent(): ParameterDecorator {
    return createParamDecoratorFactory<void, { getRequest: () => Request }, string | null>(
        (_, ctx) => {
            return ctx.getRequest().headers.get('user-agent');
        }
    )();
}

/**
 * Get the request host
 */
export function HostParam(): ParameterDecorator {
    return createParamDecoratorFactory<void, { getRequest: () => Request }, string>(
        (_, ctx) => {
            const url = new URL(ctx.getRequest().url);
            return url.host;
        }
    )();
}
