/**
 * Metadata Storage
 * I don't use reflect-metadata because it's too heavy for edge.
 * WeakMaps are great for memory safety - if the class dies, metadata dies.
 */

const classMetadata = new WeakMap<object, Map<string | symbol, unknown>>();
const methodMetadata = new WeakMap<object, Map<string | symbol, Map<string | symbol, unknown>>>();
const parameterMetadata = new WeakMap<
    object,
    Map<string | symbol, Map<number, Map<string | symbol, unknown>>>
>();
const propertyMetadata = new WeakMap<object, Map<string | symbol, Map<string | symbol, unknown>>>();

export function defineClassMetadata(
    metadataKey: string | symbol,
    metadataValue: unknown,
    target: object
): void {
    let meta = classMetadata.get(target);
    if (!meta) {
        meta = new Map();
        classMetadata.set(target, meta);
    }
    meta.set(metadataKey, metadataValue);
}

export function getClassMetadata<T = unknown>(
    metadataKey: string | symbol,
    target: object
): T | undefined {
    const meta = classMetadata.get(target);
    return meta?.get(metadataKey) as T | undefined;
}

export function hasClassMetadata(metadataKey: string | symbol, target: object): boolean {
    const meta = classMetadata.get(target);
    return meta?.has(metadataKey) ?? false;
}

export function getClassMetadataKeys(target: object): (string | symbol)[] {
    const meta = classMetadata.get(target);
    return meta ? Array.from(meta.keys()) : [];
}

// Method Metadata API (a map in a map... fun)

export function defineMethodMetadata(
    metadataKey: string | symbol,
    metadataValue: unknown,
    target: object,
    propertyKey: string | symbol
): void {
    let targetMeta = methodMetadata.get(target);
    if (!targetMeta) {
        targetMeta = new Map();
        methodMetadata.set(target, targetMeta);
    }

    let methodMeta = targetMeta.get(propertyKey);
    if (!methodMeta) {
        methodMeta = new Map();
        targetMeta.set(propertyKey, methodMeta);
    }

    methodMeta.set(metadataKey, metadataValue);
}

export function getMethodMetadata<T = unknown>(
    metadataKey: string | symbol,
    target: object,
    propertyKey: string | symbol
): T | undefined {
    const targetMeta = methodMetadata.get(target);
    const methodMeta = targetMeta?.get(propertyKey);
    return methodMeta?.get(metadataKey) as T | undefined;
}

/**
 * Check if method has metadata
 */
export function hasMethodMetadata(
    metadataKey: string | symbol,
    target: object,
    propertyKey: string | symbol
): boolean {
    const targetMeta = methodMetadata.get(target);
    const methodMeta = targetMeta?.get(propertyKey);
    return methodMeta?.has(metadataKey) ?? false;
}

/**
 * Get all method names that have metadata
 */
export function getDecoratedMethods(target: object): (string | symbol)[] {
    const targetMeta = methodMetadata.get(target);
    return targetMeta ? Array.from(targetMeta.keys()) : [];
}

export function getAllMethodMetadata(
    target: object,
    propertyKey: string | symbol
): Map<string | symbol, unknown> | undefined {
    const targetMeta = methodMetadata.get(target);
    return targetMeta?.get(propertyKey);
}

// Parameter Metadata API - the most complex one

export function defineParameterMetadata(
    metadataKey: string | symbol,
    metadataValue: unknown,
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
): void {
    const key = propertyKey ?? '__constructor__';

    let targetMeta = parameterMetadata.get(target);
    if (!targetMeta) {
        targetMeta = new Map();
        parameterMetadata.set(target, targetMeta);
    }

    let methodMeta = targetMeta.get(key);
    if (!methodMeta) {
        methodMeta = new Map();
        targetMeta.set(key, methodMeta);
    }

    let paramMeta = methodMeta.get(parameterIndex);
    if (!paramMeta) {
        paramMeta = new Map();
        methodMeta.set(parameterIndex, paramMeta);
    }

    paramMeta.set(metadataKey, metadataValue);
}

export function getParameterMetadata<T = unknown>(
    metadataKey: string | symbol,
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
): T | undefined {
    const key = propertyKey ?? '__constructor__';
    const targetMeta = parameterMetadata.get(target);
    const methodMeta = targetMeta?.get(key);
    const paramMeta = methodMeta?.get(parameterIndex);
    return paramMeta?.get(metadataKey) as T | undefined;
}

export function getAllParameterMetadata(
    target: object,
    propertyKey: string | symbol | undefined
): Map<number, Map<string | symbol, unknown>> | undefined {
    const key = propertyKey ?? '__constructor__';
    const targetMeta = parameterMetadata.get(target);
    return targetMeta?.get(key);
}

export function getParameterIndices(
    target: object,
    propertyKey: string | symbol | undefined
): number[] {
    const params = getAllParameterMetadata(target, propertyKey);
    if (!params) return [];
    return Array.from(params.keys()).sort((a, b) => a - b);
}

export function definePropertyMetadata(
    metadataKey: string | symbol,
    metadataValue: unknown,
    target: object,
    propertyKey: string | symbol
): void {
    let targetMeta = propertyMetadata.get(target);
    if (!targetMeta) {
        targetMeta = new Map();
        propertyMetadata.set(target, targetMeta);
    }

    let propMeta = targetMeta.get(propertyKey);
    if (!propMeta) {
        propMeta = new Map();
        targetMeta.set(propertyKey, propMeta);
    }

    propMeta.set(metadataKey, metadataValue);
}

export function getPropertyMetadata<T = unknown>(
    metadataKey: string | symbol,
    target: object,
    propertyKey: string | symbol
): T | undefined {
    const targetMeta = propertyMetadata.get(target);
    const propMeta = targetMeta?.get(propertyKey);
    return propMeta?.get(metadataKey) as T | undefined;
}

export function getDecoratedProperties(target: object): (string | symbol)[] {
    const targetMeta = propertyMetadata.get(target);
    return targetMeta ? Array.from(targetMeta.keys()) : [];
}

export function appendClassMetadata<T>(
    metadataKey: string | symbol,
    value: T,
    target: object
): void {
    const existing = getClassMetadata<T[]>(metadataKey, target) ?? [];
    defineClassMetadata(metadataKey, [...existing, value], target);
}

export function appendMethodMetadata<T>(
    metadataKey: string | symbol,
    value: T,
    target: object,
    propertyKey: string | symbol
): void {
    const existing = getMethodMetadata<T[]>(metadataKey, target, propertyKey) ?? [];
    defineMethodMetadata(metadataKey, [...existing, value], target, propertyKey);
}

export function mergeClassMetadata<T extends Record<string, unknown>>(
    metadataKey: string | symbol,
    value: Partial<T>,
    target: object
): void {
    const existing = getClassMetadata<T>(metadataKey, target) ?? ({} as T);
    defineClassMetadata(metadataKey, { ...existing, ...value }, target);
}

export function inheritMetadata(
    childTarget: object,
    parentTarget: object
): void {
    const parentClassMeta = classMetadata.get(parentTarget);
    if (parentClassMeta) {
        let childClassMeta = classMetadata.get(childTarget);
        if (!childClassMeta) {
            childClassMeta = new Map();
            classMetadata.set(childTarget, childClassMeta);
        }
        for (const [key, value] of parentClassMeta) {
            if (!childClassMeta.has(key)) {
                childClassMeta.set(key, value);
            }
        }
    }

    const parentMethodMeta = methodMetadata.get(parentTarget);
    if (parentMethodMeta) {
        let childMethodMeta = methodMetadata.get(childTarget);
        if (!childMethodMeta) {
            childMethodMeta = new Map();
            methodMetadata.set(childTarget, childMethodMeta);
        }
        for (const [methodKey, methodMeta] of parentMethodMeta) {
            if (!childMethodMeta.has(methodKey)) {
                childMethodMeta.set(methodKey, new Map(methodMeta));
            }
        }
    }
}

/**
 * Get all metadata for debugging purposes
 */
export function debugMetadata(target: object): {
    class: Map<string | symbol, unknown> | undefined;
    methods: Map<string | symbol, Map<string | symbol, unknown>> | undefined;
    parameters: Map<string | symbol, Map<number, Map<string | symbol, unknown>>> | undefined;
    properties: Map<string | symbol, Map<string | symbol, unknown>> | undefined;
} {
    return {
        class: classMetadata.get(target),
        methods: methodMetadata.get(target),
        parameters: parameterMetadata.get(target),
        properties: propertyMetadata.get(target),
    };
}
