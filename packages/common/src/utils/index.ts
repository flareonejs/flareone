/**
 * Utils
 * mostly stuff i didn't want to re-implement for the 100th time.
 */

/**
 * Generate a random UUID v4
 */
export function uuid(): string {
    return crypto.randomUUID();
}

/**
 * Generate a random string
 */
export function randomString(length: number, charset: string = 'alphanumeric'): string {
    const charsets: Record<string, string> = {
        alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
        alpha: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
        numeric: '0123456789',
        hex: '0123456789abcdef',
    };

    const chars = charsets[charset] ?? charset;
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);

    return Array.from(array)
        .map((byte) => chars[byte % chars.length])
        .join('');
}

/**
 * Hash a string using SHA-256
 */
export async function sha256(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    return Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Hash a string using SHA-512
 */
export async function sha512(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const buffer = await crypto.subtle.digest('SHA-512', encoder.encode(data));
    return Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Create HMAC signature
 */
export async function hmac(
    data: string,
    secret: string,
    algorithm: 'SHA-256' | 'SHA-384' | 'SHA-512' = 'SHA-256'
): Promise<string> {
    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: algorithm },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));

    return Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Constant-time string comparison
 */
export function constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
        return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}

/**
 * Base64 encode
 */
export function base64Encode(data: string | ArrayBuffer): string {
    if (typeof data === 'string') {
        return btoa(data);
    }
    return btoa(String.fromCharCode(...new Uint8Array(data)));
}

/**
 * Base64 decode
 */
export function base64Decode(data: string): string {
    return atob(data);
}

/**
 * Base64 URL-safe encode
 */
export function base64UrlEncode(data: string | ArrayBuffer): string {
    return base64Encode(data)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * Base64 URL-safe decode
 */
export function base64UrlDecode(data: string): string {
    const padded = data + '='.repeat((4 - (data.length % 4)) % 4);
    return base64Decode(padded.replace(/-/g, '+').replace(/_/g, '/'));
}

/**
 * Hex encode
 */
export function hexEncode(data: ArrayBuffer | Uint8Array): string {
    const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Hex decode
 */
export function hexDecode(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
}

/**
 * Convert string to camelCase
 */
export function camelCase(str: string): string {
    return str
        .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
        .replace(/^(.)/, (c) => c.toLowerCase());
}

/**
 * Convert string to PascalCase
 */
export function pascalCase(str: string): string {
    return str
        .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
        .replace(/^(.)/, (c) => c.toUpperCase());
}

/**
 * Convert string to snake_case
 */
export function snakeCase(str: string): string {
    return str
        .replace(/([A-Z])/g, '_$1')
        .replace(/[-\s]+/g, '_')
        .replace(/^_/, '')
        .toLowerCase();
}

/**
 * Convert string to kebab-case
 */
export function kebabCase(str: string): string {
    return str
        .replace(/([A-Z])/g, '-$1')
        .replace(/[_\s]+/g, '-')
        .replace(/^-/, '')
        .toLowerCase();
}

/**
 * Generate URL-friendly slug
 */
export function slugify(str: string): string {
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, length: number, suffix: string = '...'): string {
    if (str.length <= length) return str;
    return str.slice(0, length - suffix.length) + suffix;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (obj instanceof Date) {
        return new Date(obj.getTime()) as unknown as T;
    }

    if (Array.isArray(obj)) {
        return obj.map((item) => deepClone(item)) as unknown as T;
    }

    const cloned = {} as T;
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            cloned[key] = deepClone(obj[key]);
        }
    }
    return cloned;
}

/**
 * Deep merge objects
 */
export function deepMerge<T extends Record<string, unknown>>(
    target: T,
    ...sources: Partial<T>[]
): T {
    const result = deepClone(target);

    for (const source of sources) {
        for (const key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                const sourceValue = source[key];
                const targetValue = result[key];

                if (
                    typeof sourceValue === 'object' &&
                    sourceValue !== null &&
                    !Array.isArray(sourceValue) &&
                    typeof targetValue === 'object' &&
                    targetValue !== null &&
                    !Array.isArray(targetValue)
                ) {
                    (result as Record<string, unknown>)[key] = deepMerge(
                        targetValue as Record<string, unknown>,
                        sourceValue as Record<string, unknown>
                    );
                } else {
                    (result as Record<string, unknown>)[key] = deepClone(sourceValue);
                }
            }
        }
    }

    return result;
}

/**
 * Pick specific keys from an object
 */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
    obj: T,
    keys: K[]
): Pick<T, K> {
    const result = {} as Pick<T, K>;
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            result[key] = obj[key];
        }
    }
    return result;
}

/**
 * Omit specific keys from an object
 */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
    obj: T,
    keys: K[]
): Omit<T, K> {
    const result = { ...obj };
    for (const key of keys) {
        delete result[key];
    }
    return result as Omit<T, K>;
}

/**
 * Get nested property value
 */
export function get<T>(obj: unknown, path: string, defaultValue?: T): T | undefined {
    const keys = path.split('.');
    let result: unknown = obj;

    for (const key of keys) {
        if (result === null || result === undefined) {
            return defaultValue;
        }
        result = (result as Record<string, unknown>)[key];
    }

    return (result as T) ?? defaultValue;
}

/**
 * Set nested property value
 */
export function set<T extends Record<string, unknown>>(
    obj: T,
    path: string,
    value: unknown
): T {
    const keys = path.split('.');
    const result = deepClone(obj);
    let current: Record<string, unknown> = result;

    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i]!;
        if (!(key in current) || typeof current[key] !== 'object') {
            current[key] = {};
        }
        current = current[key] as Record<string, unknown>;
    }

    current[keys[keys.length - 1]!] = value;
    return result;
}

/**
 * Split array into chunks
 */
export function chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

/**
 * Get unique values from array
 */
export function unique<T>(arr: T[]): T[] {
    return [...new Set(arr)];
}

/**
 * Group array elements by key
 */
export function groupBy<T, K extends string | number | symbol>(
    arr: T[],
    keyFn: (item: T) => K
): Record<K, T[]> {
    return arr.reduce(
        (acc, item) => {
            const key = keyFn(item);
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(item);
            return acc;
        },
        {} as Record<K, T[]>
    );
}

/**
 * Shuffle array (Fisher-Yates)
 */
export function shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
    fn: () => Promise<T>,
    options: {
        maxAttempts?: number;
        initialDelay?: number;
        maxDelay?: number;
        factor?: number;
    } = {}
): Promise<T> {
    const {
        maxAttempts = 3,
        initialDelay = 100,
        maxDelay = 10000,
        factor = 2,
    } = options;

    let lastError: Error;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            if (attempt === maxAttempts) {
                break;
            }

            await sleep(delay);
            delay = Math.min(delay * factor, maxDelay);
        }
    }

    throw lastError!;
}

/**
 * Execute promises with concurrency limit
 */
export async function parallel<T>(
    tasks: (() => Promise<T>)[],
    concurrency: number
): Promise<T[]> {
    const results: T[] = [];
    const running: Promise<void>[] = [];
    let index = 0;

    const runNext = async (): Promise<void> => {
        const i = index++;
        if (i >= tasks.length) return;

        results[i] = await tasks[i]!();
        await runNext();
    };

    while (running.length < concurrency && index < tasks.length) {
        running.push(runNext());
    }

    await Promise.all(running);
    return results;
}

/**
 * Validate email format
 */
export function isEmail(value: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
}

/**
 * Validate URL format
 */
export function isUrl(value: string): boolean {
    try {
        new URL(value);
        return true;
    } catch {
        return false;
    }
}

/**
 * Validate UUID format
 */
export function isUuid(value: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
}

/**
 * Validate IPv4 address
 */
export function isIpv4(value: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipv4Regex.test(value)) return false;
    return value.split('.').every((octet) => {
        const num = parseInt(octet, 10);
        return num >= 0 && num <= 255;
    });
}

/**
 * Check if value is empty
 */
export function isEmpty(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
}
