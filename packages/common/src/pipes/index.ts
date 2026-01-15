/**
 * Built-in Pipes
 * simple data transformations.
 */

import {
    type PipeTransform,
    type ArgumentMetadata,
    BadRequestException,
    Injectable,
} from '@flareone/core';

export interface ParsePipeOptions {
    errorMessage?: string;
    optional?: boolean;
}

/**
 * Parse and validate integer values
 */
@Injectable()
export class ParseIntPipe implements PipeTransform<string, number> {
    constructor(private readonly options: ParsePipeOptions = {}) { }

    transform(value: string, metadata: ArgumentMetadata): number {
        if (this.options.optional && (value === undefined || value === null || value === '')) {
            return undefined as unknown as number;
        }

        const parsed = parseInt(value, 10);

        if (isNaN(parsed)) {
            throw new BadRequestException(
                this.options.errorMessage ??
                `Validation failed: ${metadata.name ?? 'value'} must be an integer`
            );
        }

        return parsed;
    }
}

/**
 * Parse and validate float values
 */
@Injectable()
export class ParseFloatPipe implements PipeTransform<string, number> {
    constructor(private readonly options: ParsePipeOptions = {}) { }

    transform(value: string, metadata: ArgumentMetadata): number {
        if (this.options.optional && (value === undefined || value === null || value === '')) {
            return undefined as unknown as number;
        }

        const parsed = parseFloat(value);

        if (isNaN(parsed)) {
            throw new BadRequestException(
                this.options.errorMessage ??
                `Validation failed: ${metadata.name ?? 'value'} must be a number`
            );
        }

        return parsed;
    }
}

/**
 * Parse and validate boolean values
 */
@Injectable()
export class ParseBoolPipe implements PipeTransform<string | boolean, boolean> {
    constructor(private readonly options: ParsePipeOptions = {}) { }

    transform(value: string | boolean, metadata: ArgumentMetadata): boolean {
        if (this.options.optional && (value === undefined || value === null || value === '')) {
            return undefined as unknown as boolean;
        }

        if (typeof value === 'boolean') {
            return value;
        }

        const lowered = String(value).toLowerCase();

        if (lowered === 'true' || lowered === '1' || lowered === 'yes') {
            return true;
        }

        if (lowered === 'false' || lowered === '0' || lowered === 'no') {
            return false;
        }

        throw new BadRequestException(
            this.options.errorMessage ??
            `Validation failed: ${metadata.name ?? 'value'} must be a boolean`
        );
    }
}

/**
 * Parse and validate UUID values
 */
@Injectable()
export class ParseUUIDPipe implements PipeTransform<string, string> {
    private static readonly UUID_REGEX =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    constructor(private readonly options: ParsePipeOptions = {}) { }

    transform(value: string, metadata: ArgumentMetadata): string {
        if (this.options.optional && (value === undefined || value === null || value === '')) {
            return undefined as unknown as string;
        }

        if (!ParseUUIDPipe.UUID_REGEX.test(value)) {
            throw new BadRequestException(
                this.options.errorMessage ??
                `Validation failed: ${metadata.name ?? 'value'} must be a valid UUID`
            );
        }

        return value.toLowerCase();
    }
}

/**
 * Parse array from comma-separated string
 */
@Injectable()
export class ParseArrayPipe implements PipeTransform<string, string[]> {
    constructor(
        private readonly options: ParsePipeOptions & { separator?: string } = {}
    ) { }

    transform(value: string, _metadata: ArgumentMetadata): string[] {
        if (this.options.optional && (value === undefined || value === null || value === '')) {
            return [];
        }

        const separator = this.options.separator ?? ',';
        return value.split(separator).map((item) => item.trim()).filter(Boolean);
    }
}

/**
 * Parse and validate enum values
 */
export class ParseEnumPipe<T extends Record<string, string | number>>
    implements PipeTransform<string, T[keyof T]> {
    private readonly allowedValues: Array<string | number>;

    constructor(
        enumType: T,
        private readonly options: ParsePipeOptions = {}
    ) {
        this.allowedValues = Object.values(enumType);
    }

    transform(value: string, metadata: ArgumentMetadata): T[keyof T] {
        if (this.options.optional && (value === undefined || value === null || value === '')) {
            return undefined as unknown as T[keyof T];
        }

        if (!this.allowedValues.includes(value)) {
            throw new BadRequestException(
                this.options.errorMessage ??
                `Validation failed: ${metadata.name ?? 'value'} must be one of: ${this.allowedValues.join(', ')}`
            );
        }

        return value as T[keyof T];
    }
}

export interface ValidationPipeOptions {
    whitelist?: boolean;
    forbidNonWhitelisted?: boolean;
    transform?: boolean;
    groups?: string[];
    skipMissingProperties?: boolean;
    skipUndefinedProperties?: boolean;
    skipNullProperties?: boolean;
}

/**
 * Simple validation pipe using schema definition
 */
@Injectable()
export class ValidationPipe implements PipeTransform {
    constructor(private readonly options: ValidationPipeOptions = {}) { }

    transform(value: unknown, _metadata: ArgumentMetadata): unknown {
        if (value === undefined && this.options.skipUndefinedProperties) {
            return value;
        }

        if (value === null && this.options.skipNullProperties) {
            return value;
        }

        if ((value === null || value === undefined) && this.options.skipMissingProperties) {
            return value;
        }

        if (typeof value !== 'object' || value === null) {
            return value;
        }

        const result = { ...value } as Record<string, unknown>;

        if (this.options.whitelist || this.options.forbidNonWhitelisted) {
            const knownKeys = new Set(Object.keys(value));

            if (this.options.forbidNonWhitelisted && knownKeys.size > 0) {
                const unknownKeys = Array.from(knownKeys);
                if (unknownKeys.length > 0) {
                    throw new BadRequestException(
                        `Unknown properties: ${unknownKeys.join(', ')}`
                    );
                }
            }

            if (this.options.whitelist) {
                for (const key of knownKeys) {
                    delete result[key];
                }
            }
        }

        return result;
    }
}

/**
 * Default value pipe - provides a default when value is missing
 */
export class DefaultValuePipe<T = unknown> implements PipeTransform<T, T> {
    constructor(private readonly defaultValue: T) { }

    transform(value: T): T {
        if (value === undefined || value === null || value === '') {
            return this.defaultValue;
        }
        return value;
    }
}

/**
 * Trim pipe - trims whitespace from strings
 */
@Injectable()
export class TrimPipe implements PipeTransform<string, string> {
    transform(value: string): string {
        if (typeof value !== 'string') {
            return value;
        }
        return value.trim();
    }
}

/**
 * Lowercase pipe - converts strings to lowercase
 */
@Injectable()
export class LowerCasePipe implements PipeTransform<string, string> {
    transform(value: string): string {
        if (typeof value !== 'string') {
            return value;
        }
        return value.toLowerCase();
    }
}

/**
 * Uppercase pipe - converts strings to uppercase
 */
@Injectable()
export class UpperCasePipe implements PipeTransform<string, string> {
    transform(value: string): string {
        if (typeof value !== 'string') {
            return value;
        }
        return value.toUpperCase();
    }
}

export interface FileValidatorOptions {
    maxSize?: number;
    mimeTypes?: string[];
}

/**
 * File validation pipe
 */
export class FileValidationPipe implements PipeTransform {
    constructor(private readonly options: FileValidatorOptions = {}) { }

    async transform(value: unknown, _metadata: ArgumentMetadata): Promise<unknown> {
        if (!(value instanceof File)) {
            throw new BadRequestException('Expected a file');
        }

        if (this.options.maxSize && value.size > this.options.maxSize) {
            throw new BadRequestException(
                `File size exceeds maximum allowed size of ${this.options.maxSize} bytes`
            );
        }

        if (this.options.mimeTypes && !this.options.mimeTypes.includes(value.type)) {
            throw new BadRequestException(
                `Invalid file type. Allowed types: ${this.options.mimeTypes.join(', ')}`
            );
        }

        return value;
    }
}
