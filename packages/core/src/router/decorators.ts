/**
 * Routing Decorators
 * routes, paths, and methods.
 */

import { CONTROLLER_METADATA, ROUTE_METADATA, HTTP_METHODS, type HttpMethod, type HttpStatus } from '../constants.js';
import {
    defineClassMetadata,
    defineMethodMetadata,
    getMethodMetadata,
} from '../metadata.js';
import type { Type, ControllerOptions, RouteMetadata } from '../types.js';

type ClassDecorator = <T extends Type>(target: T) => T | void;
type MethodDecorator = <T>(
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>
) => TypedPropertyDescriptor<T> | void;

export function Controller(pathOrOptions?: string | ControllerOptions): ClassDecorator {
    return (target) => {
        const options: ControllerOptions =
            typeof pathOrOptions === 'string'
                ? { path: pathOrOptions }
                : pathOrOptions ?? {};

        defineClassMetadata(CONTROLLER_METADATA.IS_CONTROLLER, true, target);
        defineClassMetadata(CONTROLLER_METADATA.PATH, options.path ?? '', target);

        if (options.version) {
            defineClassMetadata(CONTROLLER_METADATA.VERSION, options.version, target);
        }
        if (options.host) {
            defineClassMetadata(CONTROLLER_METADATA.HOST, options.host, target);
        }
        if (options.scope) {
            defineClassMetadata(CONTROLLER_METADATA.SCOPE, options.scope, target);
        }

        return target;
    };
}

function createMethodDecorator(method: HttpMethod) {
    return function (path: string = ''): MethodDecorator {
        return (target, propertyKey, descriptor) => {
            const metadata: RouteMetadata = {
                method,
                path,
                methodName: String(propertyKey),
            };

            defineMethodMetadata(ROUTE_METADATA.METHOD, method, target, propertyKey);
            defineMethodMetadata(ROUTE_METADATA.PATH, path, target, propertyKey);
            defineMethodMetadata('__route__', metadata, target, propertyKey);

            return descriptor;
        };
    };
}

export const Get = createMethodDecorator(HTTP_METHODS.GET);

export const Post = createMethodDecorator(HTTP_METHODS.POST);

export const Put = createMethodDecorator(HTTP_METHODS.PUT);

export const Delete = createMethodDecorator(HTTP_METHODS.DELETE);

export const Patch = createMethodDecorator(HTTP_METHODS.PATCH);

export const Options = createMethodDecorator(HTTP_METHODS.OPTIONS);

export const Head = createMethodDecorator(HTTP_METHODS.HEAD);

export const All = createMethodDecorator(HTTP_METHODS.ALL);

export function HttpCode(statusCode: HttpStatus): MethodDecorator {
    return (target, propertyKey, descriptor) => {
        defineMethodMetadata(ROUTE_METADATA.STATUS_CODE, statusCode, target, propertyKey);
        return descriptor;
    };
}

export function Header(name: string, value: string): MethodDecorator {
    return (target, propertyKey, descriptor) => {
        const headers = getMethodMetadata<Record<string, string>>(
            ROUTE_METADATA.HEADERS,
            target,
            propertyKey
        ) ?? {};

        headers[name] = value;
        defineMethodMetadata(ROUTE_METADATA.HEADERS, headers, target, propertyKey);

        return descriptor;
    };
}

export function Redirect(url: string, statusCode: HttpStatus = 302): MethodDecorator {
    return (target, propertyKey, descriptor) => {
        defineMethodMetadata(ROUTE_METADATA.REDIRECT, { url, statusCode }, target, propertyKey);
        return descriptor;
    };
}

export interface RouteVersionOptions {
    version: string | string[];
}

export function Version(version: string | string[]): ClassDecorator & MethodDecorator {
    return ((
        targetOrPrototype: object,
        propertyKey?: string | symbol,
        descriptor?: PropertyDescriptor
    ) => {
        if (propertyKey !== undefined && descriptor) {
            defineMethodMetadata(CONTROLLER_METADATA.VERSION, version, targetOrPrototype, propertyKey);
            return descriptor;
        } else {
            defineClassMetadata(CONTROLLER_METADATA.VERSION, version, targetOrPrototype);
            return targetOrPrototype;
        }
    }) as ClassDecorator & MethodDecorator;
}

export function Host(host: string | string[]): ClassDecorator {
    return (target) => {
        defineClassMetadata(CONTROLLER_METADATA.HOST, host, target);
        return target;
    };
}
