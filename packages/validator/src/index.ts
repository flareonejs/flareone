/**
 * @flareone/validator - DTO Validation
 * Complete set of validation decorators for Flareone
 */

import {
    getClassMetadata,
    appendClassMetadata,
    definePropertyMetadata,
    getPropertyMetadata,
    getDecoratedProperties,
} from '@flareone/core';

export interface ValidationError {
    property: string;
    constraint: string;
    message: string;
    value?: unknown;
    children?: ValidationError[];
}

export interface ValidateOptions {
    skipMissingProperties?: boolean;
    skipNullProperties?: boolean;
    skipUndefinedProperties?: boolean;
    groups?: string[];
    always?: boolean;
    stopAtFirstError?: boolean;
    whitelist?: boolean;
    forbidNonWhitelisted?: boolean;
    messages?: Record<string, string>;
}

export type ValidatorFn = (value: unknown, object?: unknown, property?: string) => boolean | Promise<boolean>;

export interface ValidationConstraint {
    name: string;
    validator: ValidatorFn;
    message: string | ((value: unknown, args?: unknown[]) => string);
    args?: unknown[];
    groups?: string[];
    always?: boolean;
    condition?: (object: unknown) => boolean;
}

export interface PropertyValidationMeta {
    constraints: ValidationConstraint[];
    isOptional?: boolean;
    nestedType?: new () => unknown;
    isArray?: boolean;
}

export type TransformFn = (value: unknown, object?: unknown) => unknown;

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    value?: unknown;
}

const VALIDATION_KEY = Symbol('validation:constraints');
const TRANSFORM_KEY = Symbol('validation:transforms');
const CLASS_VALIDATORS_KEY = Symbol('validation:classValidators');
const OPTIONAL_KEY = Symbol('validation:optional');
const NESTED_TYPE_KEY = Symbol('validation:nestedType');
const IS_ARRAY_KEY = Symbol('validation:isArray');

function addConstraint(target: Function, propertyKey: string | symbol, constraint: ValidationConstraint): void {
    const existing = getPropertyMetadata<ValidationConstraint[]>(VALIDATION_KEY, target, propertyKey) ?? [];
    definePropertyMetadata(VALIDATION_KEY, [...existing, constraint], target, propertyKey);
}

function addTransformer(target: Function, propertyKey: string | symbol, transformer: TransformFn): void {
    const existing = getPropertyMetadata<TransformFn[]>(TRANSFORM_KEY, target, propertyKey) ?? [];
    definePropertyMetadata(TRANSFORM_KEY, [...existing, transformer], target, propertyKey);
}

interface ValidatorOptions {
    message?: string | ((value: unknown, args?: unknown[]) => string);
    groups?: string[];
    always?: boolean;
    each?: boolean;
    condition?: (object: unknown) => boolean;
}

function createValidator(
    name: string,
    validator: ValidatorFn,
    defaultMessage: string | ((value: unknown, args?: unknown[]) => string),
    args?: unknown[]
) {
    return (options?: ValidatorOptions): PropertyDecorator => {
        return (target, propertyKey) => {
            const constraint: ValidationConstraint = {
                name,
                validator,
                message: options?.message ?? defaultMessage,
                args,
                groups: options?.groups,
                always: options?.always,
                condition: options?.condition,
            };

            if (options?.each) {
                const originalValidator = constraint.validator;
                constraint.validator = async (value, object, property) => {
                    if (!Array.isArray(value)) return false;
                    for (const item of value) {
                        if (!(await originalValidator(item, object, property))) {
                            return false;
                        }
                    }
                    return true;
                };
            }

            addConstraint(target.constructor, propertyKey, constraint);
        };
    };
}

/**
 * Checks if value is defined (not undefined, not null)
 */
export const IsDefined = createValidator(
    'isDefined',
    (value) => value !== undefined && value !== null,
    'Property must be defined'
);

/**
 * Property is optional
 */
export function IsOptional(_options?: { groups?: string[] }): PropertyDecorator {
    return (target, propertyKey) => {
        definePropertyMetadata(OPTIONAL_KEY, true, target.constructor, propertyKey);
    };
}

/**
 * Checks if value is not empty
 */
export const IsNotEmpty = createValidator(
    'isNotEmpty',
    (value) => {
        if (value === null || value === undefined) return false;
        if (typeof value === 'string') return value.trim().length > 0;
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'object') return Object.keys(value).length > 0;
        return true;
    },
    'Property should not be empty'
);

/**
 * Checks if value is empty
 */
export const IsEmpty = createValidator(
    'isEmpty',
    (value) => {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string') return value.trim().length === 0;
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === 'object') return Object.keys(value).length === 0;
        return false;
    },
    'Property should be empty'
);

export const IsString = createValidator(
    'isString',
    (value) => typeof value === 'string',
    'Property must be a string'
);

export const IsNumber = createValidator(
    'isNumber',
    (value) => typeof value === 'number' && !isNaN(value),
    'Property must be a number'
);

export const IsInt = createValidator(
    'isInt',
    (value) => typeof value === 'number' && Number.isInteger(value),
    'Property must be an integer'
);

export const IsBoolean = createValidator(
    'isBoolean',
    (value) => typeof value === 'boolean',
    'Property must be a boolean'
);

export const IsDate = createValidator(
    'isDate',
    (value) => value instanceof Date && !isNaN(value.getTime()),
    'Property must be a valid date'
);

export const IsDateString = createValidator(
    'isDateString',
    (value) => {
        if (typeof value !== 'string') return false;
        const date = new Date(value);
        return !isNaN(date.getTime());
    },
    'Property must be a valid date string'
);

export const IsArray = createValidator(
    'isArray',
    (value) => Array.isArray(value),
    'Property must be an array'
);

export const IsObject = createValidator(
    'isObject',
    (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
    'Property must be an object'
);

export const IsNull = createValidator(
    'isNull',
    (value) => value === null,
    'Property must be null'
);

export function IsEnum(entity: object, options?: ValidatorOptions): PropertyDecorator {
    const enumValues = Object.values(entity);
    return createValidator(
        'isEnum',
        (value) => enumValues.includes(value),
        () => `Property must be one of: ${enumValues.join(', ')}`,
        [entity]
    )(options);
}

export function Length(min: number, max?: number, options?: ValidatorOptions): PropertyDecorator {
    return createValidator(
        'length',
        (value) => {
            if (typeof value !== 'string') return false;
            return value.length >= min && (max === undefined || value.length <= max);
        },
        max !== undefined
            ? `String length must be between ${min} and ${max}`
            : `String length must be at least ${min}`,
        [min, max]
    )(options);
}

export function MinLength(min: number, options?: ValidatorOptions): PropertyDecorator {
    return createValidator(
        'minLength',
        (value) => typeof value === 'string' && value.length >= min,
        `String must be at least ${min} characters`,
        [min]
    )(options);
}

export function MaxLength(max: number, options?: ValidatorOptions): PropertyDecorator {
    return createValidator(
        'maxLength',
        (value) => typeof value === 'string' && value.length <= max,
        `String must be at most ${max} characters`,
        [max]
    )(options);
}

export function Matches(pattern: RegExp, options?: ValidatorOptions): PropertyDecorator {
    return createValidator(
        'matches',
        (value) => typeof value === 'string' && pattern.test(value),
        `String must match pattern: ${pattern}`,
        [pattern]
    )(options);
}

export function Contains(seed: string, options?: ValidatorOptions): PropertyDecorator {
    return createValidator(
        'contains',
        (value) => typeof value === 'string' && value.includes(seed),
        `String must contain "${seed}"`,
        [seed]
    )(options);
}

export function NotContains(seed: string, options?: ValidatorOptions): PropertyDecorator {
    return createValidator(
        'notContains',
        (value) => typeof value === 'string' && !value.includes(seed),
        `String must not contain "${seed}"`,
        [seed]
    )(options);
}

export const IsEmail = createValidator(
    'isEmail',
    (value) => {
        if (typeof value !== 'string') return false;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value);
    },
    'Property must be a valid email'
);

export const IsUrl = createValidator(
    'isUrl',
    (value) => {
        if (typeof value !== 'string') return false;
        try {
            new URL(value);
            return true;
        } catch {
            return false;
        }
    },
    'Property must be a valid URL'
);

export const IsUUID = createValidator(
    'isUUID',
    (value) => {
        if (typeof value !== 'string') return false;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(value);
    },
    'Property must be a valid UUID'
);

export const IsAlphanumeric = createValidator(
    'isAlphanumeric',
    (value) => typeof value === 'string' && /^[a-zA-Z0-9]+$/.test(value),
    'Property must contain only letters and numbers'
);

export const IsAlpha = createValidator(
    'isAlpha',
    (value) => typeof value === 'string' && /^[a-zA-Z]+$/.test(value),
    'Property must contain only letters'
);

export const IsNumberString = createValidator(
    'isNumberString',
    (value) => typeof value === 'string' && /^[0-9]+$/.test(value),
    'Property must be a numeric string'
);

export const IsLowercase = createValidator(
    'isLowercase',
    (value) => typeof value === 'string' && value === value.toLowerCase(),
    'Property must be lowercase'
);

export const IsUppercase = createValidator(
    'isUppercase',
    (value) => typeof value === 'string' && value === value.toUpperCase(),
    'Property must be uppercase'
);

export function IsIP(version?: 4 | 6, options?: ValidatorOptions): PropertyDecorator {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$/;

    return createValidator(
        'isIP',
        (value) => {
            if (typeof value !== 'string') return false;
            if (version === 4) return ipv4Regex.test(value);
            if (version === 6) return ipv6Regex.test(value);
            return ipv4Regex.test(value) || ipv6Regex.test(value);
        },
        version ? `Property must be a valid IPv${version} address` : 'Property must be a valid IP address',
        [version]
    )(options);
}

export const IsJSON = createValidator(
    'isJSON',
    (value) => {
        if (typeof value !== 'string') return false;
        try {
            JSON.parse(value);
            return true;
        } catch {
            return false;
        }
    },
    'Property must be a valid JSON string'
);

export const IsJWT = createValidator(
    'isJWT',
    (value) => {
        if (typeof value !== 'string') return false;
        const parts = value.split('.');
        if (parts.length !== 3) return false;
        try {
            parts.forEach(part => atob(part.replace(/-/g, '+').replace(/_/g, '/')));
            return true;
        } catch {
            return false;
        }
    },
    'Property must be a valid JWT'
);

export const IsHexadecimal = createValidator(
    'isHexadecimal',
    (value) => typeof value === 'string' && /^[0-9a-fA-F]+$/.test(value),
    'Property must be hexadecimal'
);

export const IsHexColor = createValidator(
    'isHexColor',
    (value) => typeof value === 'string' && /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value),
    'Property must be a valid hex color'
);

export const IsPhoneNumber = createValidator(
    'isPhoneNumber',
    (value) => {
        if (typeof value !== 'string') return false;
        return /^\+?[1-9]\d{1,14}$/.test(value.replace(/[\s\-\(\)]/g, ''));
    },
    'Property must be a valid phone number'
);

export const IsCreditCard = createValidator(
    'isCreditCard',
    (value) => {
        if (typeof value !== 'string') return false;
        const digits = value.replace(/\D/g, '');
        if (digits.length < 13 || digits.length > 19) return false;

        let sum = 0;
        let isEven = false;
        for (let i = digits.length - 1; i >= 0; i--) {
            let digit = parseInt(digits[i]!, 10);
            if (isEven) {
                digit *= 2;
                if (digit > 9) digit -= 9;
            }
            sum += digit;
            isEven = !isEven;
        }
        return sum % 10 === 0;
    },
    'Property must be a valid credit card number'
);

export const IsBase64 = createValidator(
    'isBase64',
    (value) => {
        if (typeof value !== 'string') return false;
        try {
            return btoa(atob(value)) === value;
        } catch {
            return false;
        }
    },
    'Property must be base64 encoded'
);

export const IsSlug = createValidator(
    'isSlug',
    (value) => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
    'Property must be a valid slug'
);

export function IsStrongPassword(options?: {
    minLength?: number;
    minLowercase?: number;
    minUppercase?: number;
    minNumbers?: number;
    minSymbols?: number;
} & ValidatorOptions): PropertyDecorator {
    const opts = {
        minLength: options?.minLength ?? 8,
        minLowercase: options?.minLowercase ?? 1,
        minUppercase: options?.minUppercase ?? 1,
        minNumbers: options?.minNumbers ?? 1,
        minSymbols: options?.minSymbols ?? 1,
    };

    return createValidator(
        'isStrongPassword',
        (value) => {
            if (typeof value !== 'string') return false;
            if (value.length < opts.minLength) return false;
            if ((value.match(/[a-z]/g) || []).length < opts.minLowercase) return false;
            if ((value.match(/[A-Z]/g) || []).length < opts.minUppercase) return false;
            if ((value.match(/[0-9]/g) || []).length < opts.minNumbers) return false;
            if ((value.match(/[^a-zA-Z0-9]/g) || []).length < opts.minSymbols) return false;
            return true;
        },
        `Password must be at least ${opts.minLength} characters with uppercase, lowercase, numbers, and symbols`,
        [opts]
    )(options);
}

export function Min(min: number, options?: ValidatorOptions): PropertyDecorator {
    return createValidator(
        'min',
        (value) => typeof value === 'number' && value >= min,
        `Value must be at least ${min}`,
        [min]
    )(options);
}

export function Max(max: number, options?: ValidatorOptions): PropertyDecorator {
    return createValidator(
        'max',
        (value) => typeof value === 'number' && value <= max,
        `Value must be at most ${max}`,
        [max]
    )(options);
}

export const IsPositive = createValidator(
    'isPositive',
    (value) => typeof value === 'number' && value > 0,
    'Value must be positive'
);

export const IsNegative = createValidator(
    'isNegative',
    (value) => typeof value === 'number' && value < 0,
    'Value must be negative'
);

export function IsInRange(min: number, max: number, options?: ValidatorOptions): PropertyDecorator {
    return createValidator(
        'isInRange',
        (value) => typeof value === 'number' && value >= min && value <= max,
        `Value must be between ${min} and ${max}`,
        [min, max]
    )(options);
}

export function IsDivisibleBy(num: number, options?: ValidatorOptions): PropertyDecorator {
    return createValidator(
        'isDivisibleBy',
        (value) => typeof value === 'number' && value % num === 0,
        `Value must be divisible by ${num}`,
        [num]
    )(options);
}

export function DecimalPlaces(places: number, options?: ValidatorOptions): PropertyDecorator {
    return createValidator(
        'decimalPlaces',
        (value) => {
            if (typeof value !== 'number') return false;
            const parts = value.toString().split('.');
            return !parts[1] || parts[1].length <= places;
        },
        `Value must have at most ${places} decimal places`,
        [places]
    )(options);
}

export function ArrayMinSize(min: number, options?: ValidatorOptions): PropertyDecorator {
    return createValidator(
        'arrayMinSize',
        (value) => Array.isArray(value) && value.length >= min,
        `Array must contain at least ${min} elements`,
        [min]
    )(options);
}

export function ArrayMaxSize(max: number, options?: ValidatorOptions): PropertyDecorator {
    return createValidator(
        'arrayMaxSize',
        (value) => Array.isArray(value) && value.length <= max,
        `Array must contain at most ${max} elements`,
        [max]
    )(options);
}

export const ArrayUnique = createValidator(
    'arrayUnique',
    (value) => {
        if (!Array.isArray(value)) return false;
        return new Set(value).size === value.length;
    },
    'Array must contain unique values'
);

export const ArrayNotEmpty = createValidator(
    'arrayNotEmpty',
    (value) => Array.isArray(value) && value.length > 0,
    'Array must not be empty'
);

export function ArrayContains(values: unknown[], options?: ValidatorOptions): PropertyDecorator {
    return createValidator(
        'arrayContains',
        (value) => {
            if (!Array.isArray(value)) return false;
            return values.every(v => value.includes(v));
        },
        `Array must contain: ${values.join(', ')}`,
        [values]
    )(options);
}

export function ArrayNotContains(values: unknown[], options?: ValidatorOptions): PropertyDecorator {
    return createValidator(
        'arrayNotContains',
        (value) => {
            if (!Array.isArray(value)) return false;
            return !values.some(v => value.includes(v));
        },
        `Array must not contain: ${values.join(', ')}`,
        [values]
    )(options);
}

export function IsIn(values: unknown[], options?: ValidatorOptions): PropertyDecorator {
    return createValidator(
        'isIn',
        (value) => values.includes(value),
        `Value must be one of: ${values.join(', ')}`,
        [values]
    )(options);
}

export function IsNotIn(values: unknown[], options?: ValidatorOptions): PropertyDecorator {
    return createValidator(
        'isNotIn',
        (value) => !values.includes(value),
        `Value must not be one of: ${values.join(', ')}`,
        [values]
    )(options);
}

/**
 * Validate nested object. Must use @Type() decorator to specify the nested class type.
 */
export function ValidateNested(options?: ValidatorOptions): PropertyDecorator {
    return (target, propertyKey) => {
        addConstraint(target.constructor, propertyKey, {
            name: 'validateNested',
            validator: () => true,
            message: 'Nested validation failed',
            groups: options?.groups,
            always: options?.always,
        });
    };
}

/**
 * Specify type for nested validation. Required since we don't use reflect-metadata.
 */
export function Type(typeFunction: () => new () => unknown): PropertyDecorator {
    return (target, propertyKey) => {
        definePropertyMetadata(NESTED_TYPE_KEY, typeFunction(), target.constructor, propertyKey);
    };
}

/**
 * Mark as array of nested objects
 */
export function IsArrayOf(typeFunction: () => new () => unknown): PropertyDecorator {
    return (target, propertyKey) => {
        definePropertyMetadata(NESTED_TYPE_KEY, typeFunction(), target.constructor, propertyKey);
        definePropertyMetadata(IS_ARRAY_KEY, true, target.constructor, propertyKey);
        addConstraint(target.constructor, propertyKey, {
            name: 'isArray',
            validator: (value) => Array.isArray(value),
            message: 'Property must be an array',
        });
    };
}

export function Equals(property: string, options?: ValidatorOptions): PropertyDecorator {
    return createValidator(
        'equals',
        (value, object) => {
            const obj = object as Record<string, unknown>;
            return value === obj[property];
        },
        `Value must equal ${property}`,
        [property]
    )(options);
}

export function NotEquals(property: string, options?: ValidatorOptions): PropertyDecorator {
    return createValidator(
        'notEquals',
        (value, object) => {
            const obj = object as Record<string, unknown>;
            return value !== obj[property];
        },
        `Value must not equal ${property}`,
        [property]
    )(options);
}

export function IsBefore(date: Date | (() => Date), options?: ValidatorOptions): PropertyDecorator {
    return createValidator(
        'isBefore',
        (value) => {
            const d = value instanceof Date ? value : new Date(value as string);
            const compareDate = typeof date === 'function' ? date() : date;
            return d < compareDate;
        },
        `Date must be before ${typeof date === 'function' ? 'specified date' : date.toISOString()}`,
        [date]
    )(options);
}

export function IsAfter(date: Date | (() => Date), options?: ValidatorOptions): PropertyDecorator {
    return createValidator(
        'isAfter',
        (value) => {
            const d = value instanceof Date ? value : new Date(value as string);
            const compareDate = typeof date === 'function' ? date() : date;
            return d > compareDate;
        },
        `Date must be after ${typeof date === 'function' ? 'specified date' : date.toISOString()}`,
        [date]
    )(options);
}

export const IsFutureDate = createValidator(
    'isFutureDate',
    (value) => {
        const d = value instanceof Date ? value : new Date(value as string);
        return d > new Date();
    },
    'Date must be in the future'
);

export const IsPastDate = createValidator(
    'isPastDate',
    (value) => {
        const d = value instanceof Date ? value : new Date(value as string);
        return d < new Date();
    },
    'Date must be in the past'
);

export function Validate(
    validator: ValidatorFn,
    message: string | ((value: unknown) => string),
    options?: ValidatorOptions
): PropertyDecorator {
    return createValidator('custom', validator, message)(options);
}

export function ValidateIf(
    condition: (object: unknown) => boolean,
    _options?: ValidatorOptions
): PropertyDecorator {
    return (target, propertyKey) => {
        const existing = getPropertyMetadata<ValidationConstraint[]>(VALIDATION_KEY, target.constructor, propertyKey) ?? [];
        existing.forEach(c => {
            const originalCondition = c.condition;
            c.condition = (obj) => {
                if (!condition(obj)) return false;
                return originalCondition ? originalCondition(obj) : true;
            };
        });
        definePropertyMetadata(VALIDATION_KEY, existing, target.constructor, propertyKey);
    };
}

/**
 * Add a class-level validation constraint
 */
export function ValidateClass(
    validator: ValidatorFn,
    message: string | ((value: unknown) => string),
    options?: { groups?: string[]; always?: boolean }
): ClassDecorator {
    return (target) => {
        appendClassMetadata<ValidationConstraint>(CLASS_VALIDATORS_KEY, {
            name: 'classValidator',
            validator,
            message,
            groups: options?.groups,
            always: options?.always,
        }, target);
    };
}

export function AtLeastOneOf(properties: string[], message?: string): ClassDecorator {
    return ValidateClass(
        (value) => {
            const obj = value as Record<string, unknown>;
            return properties.some(prop => obj[prop] !== undefined && obj[prop] !== null && obj[prop] !== '');
        },
        message ?? `At least one of [${properties.join(', ')}] must be provided`
    );
}

export function ExactlyOneOf(properties: string[], message?: string): ClassDecorator {
    return ValidateClass(
        (value) => {
            const obj = value as Record<string, unknown>;
            const provided = properties.filter(prop =>
                obj[prop] !== undefined && obj[prop] !== null && obj[prop] !== ''
            );
            return provided.length === 1;
        },
        message ?? `Exactly one of [${properties.join(', ')}] must be provided`
    );
}

export function RequiresTogether(properties: string[], message?: string): ClassDecorator {
    return ValidateClass(
        (value) => {
            const obj = value as Record<string, unknown>;
            const provided = properties.filter(prop =>
                obj[prop] !== undefined && obj[prop] !== null
            );
            return provided.length === 0 || provided.length === properties.length;
        },
        message ?? `Properties [${properties.join(', ')}] must be provided together`
    );
}

export function Transform(transformer: TransformFn): PropertyDecorator {
    return (target, propertyKey) => {
        addTransformer(target.constructor, propertyKey, transformer);
    };
}

export function Trim(): PropertyDecorator {
    return Transform((value) => typeof value === 'string' ? value.trim() : value);
}

export function ToLowerCase(): PropertyDecorator {
    return Transform((value) => typeof value === 'string' ? value.toLowerCase() : value);
}

export function ToUpperCase(): PropertyDecorator {
    return Transform((value) => typeof value === 'string' ? value.toUpperCase() : value);
}

export function ToNumber(): PropertyDecorator {
    return Transform((value) => {
        const num = Number(value);
        return isNaN(num) ? value : num;
    });
}

export function ToInt(): PropertyDecorator {
    return Transform((value) => {
        const num = parseInt(String(value), 10);
        return isNaN(num) ? value : num;
    });
}

export function ToBoolean(): PropertyDecorator {
    return Transform((value) => {
        if (value === 'true' || value === '1' || value === 1) return true;
        if (value === 'false' || value === '0' || value === 0) return false;
        return Boolean(value);
    });
}

export function ToDate(): PropertyDecorator {
    return Transform((value) => {
        if (value instanceof Date) return value;
        const date = new Date(value as string | number);
        return isNaN(date.getTime()) ? value : date;
    });
}

export function Default(defaultValue: unknown | (() => unknown)): PropertyDecorator {
    return Transform((value) => {
        if (value === undefined || value === null) {
            return typeof defaultValue === 'function' ? (defaultValue as () => unknown)() : defaultValue;
        }
        return value;
    });
}

export function Exclude(): PropertyDecorator {
    return Transform(() => undefined);
}

export function Expose(): PropertyDecorator {
    return (target, propertyKey) => {
        addConstraint(target.constructor, propertyKey, {
            name: 'expose',
            validator: () => true,
            message: '',
        });
    };
}

/**
 * Validate an object against its decorators
 */
export async function validate(
    object: unknown,
    options: ValidateOptions = {}
): Promise<ValidationResult> {
    if (typeof object !== 'object' || object === null) {
        return {
            valid: false,
            errors: [{
                property: '',
                constraint: 'isObject',
                message: 'Value must be an object',
                value: object,
            }],
        };
    }

    const errors: ValidationError[] = [];
    const target = object.constructor;
    const decoratedProperties = getDecoratedProperties(target);

    if (decoratedProperties.length === 0) {
        return { valid: true, errors: [], value: object };
    }

    const obj = object as Record<string, unknown>;
    const transformedObj: Record<string, unknown> = {};
    const processedProperties = new Set<string>();

    for (const propertyKey of decoratedProperties) {
        const property = String(propertyKey);
        processedProperties.add(property);
        let value = obj[property];

        const transformers = getPropertyMetadata<TransformFn[]>(TRANSFORM_KEY, target, propertyKey);
        if (transformers) {
            for (const transformer of transformers) {
                value = transformer(value, obj);
            }
        }

        transformedObj[property] = value;

        const isOptional = getPropertyMetadata<boolean>(OPTIONAL_KEY, target, propertyKey);

        if (value === undefined && (options.skipUndefinedProperties || isOptional)) continue;
        if (value === null && (options.skipNullProperties || isOptional)) continue;
        if ((value === undefined || value === null) && options.skipMissingProperties) continue;

        const constraints = getPropertyMetadata<ValidationConstraint[]>(VALIDATION_KEY, target, propertyKey) ?? [];

        for (const constraint of constraints) {
            if (constraint.name === 'expose') continue;

            if (options.groups && options.groups.length > 0) {
                if (!constraint.always && constraint.groups) {
                    const hasMatchingGroup = constraint.groups.some(g => options.groups!.includes(g));
                    if (!hasMatchingGroup) continue;
                }
            }

            if (constraint.condition && !constraint.condition(obj)) continue;

            const isValid = await constraint.validator(value, obj, property);

            if (!isValid) {
                const message = typeof constraint.message === 'function'
                    ? constraint.message(value, constraint.args)
                    : constraint.message;

                errors.push({
                    property,
                    constraint: constraint.name,
                    message,
                    value,
                });

                if (options.stopAtFirstError) {
                    return { valid: false, errors, value: transformedObj };
                }
            }
        }

        const nestedType = getPropertyMetadata<new () => unknown>(NESTED_TYPE_KEY, target, propertyKey);
        const isArray = getPropertyMetadata<boolean>(IS_ARRAY_KEY, target, propertyKey);

        if (nestedType && value !== undefined && value !== null) {
            if (isArray && Array.isArray(value)) {
                for (let i = 0; i < value.length; i++) {
                    const item = value[i];
                    const nestedResult = await validate(
                        Object.assign(new nestedType() as object, item),
                        options
                    );
                    if (!nestedResult.valid) {
                        errors.push({
                            property: `${property}[${i}]`,
                            constraint: 'nestedValidation',
                            message: 'Nested validation failed',
                            value: item,
                            children: nestedResult.errors,
                        });
                    }
                    (value as unknown[])[i] = nestedResult.value;
                }
            } else if (typeof value === 'object') {
                const nestedResult = await validate(
                    Object.assign(new nestedType() as object, value),
                    options
                );
                if (!nestedResult.valid) {
                    errors.push({
                        property,
                        constraint: 'nestedValidation',
                        message: 'Nested validation failed',
                        value,
                        children: nestedResult.errors,
                    });
                }
                transformedObj[property] = nestedResult.value;
            }
        }
    }

    if (options.whitelist || options.forbidNonWhitelisted) {
        for (const key of Object.keys(obj)) {
            if (!processedProperties.has(key)) {
                if (options.forbidNonWhitelisted) {
                    errors.push({
                        property: key,
                        constraint: 'whitelistValidation',
                        message: `Property "${key}" should not exist`,
                        value: obj[key],
                    });
                }
            } else {
                transformedObj[key] = obj[key];
            }
        }
    } else {
        for (const key of Object.keys(obj)) {
            if (!Object.prototype.hasOwnProperty.call(transformedObj, key)) {
                transformedObj[key] = obj[key];
            }
        }
    }

    const classValidators = getClassMetadata<ValidationConstraint[]>(CLASS_VALIDATORS_KEY, target);
    if (classValidators) {
        for (const constraint of classValidators) {
            if (options.groups && options.groups.length > 0) {
                if (!constraint.always && constraint.groups) {
                    const hasMatchingGroup = constraint.groups.some(g => options.groups!.includes(g));
                    if (!hasMatchingGroup) continue;
                }
            }

            if (constraint.condition && !constraint.condition(transformedObj)) continue;

            const isValid = await constraint.validator(transformedObj, undefined, '');

            if (!isValid) {
                const message = typeof constraint.message === 'function'
                    ? constraint.message(transformedObj, constraint.args)
                    : constraint.message;

                errors.push({
                    property: '_class',
                    constraint: constraint.name,
                    message,
                    value: transformedObj,
                });

                if (options.stopAtFirstError) {
                    return { valid: false, errors, value: transformedObj };
                }
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        value: transformedObj,
    };
}

/**
 * Validate and throw if invalid
 */
export async function validateOrThrow(
    object: unknown,
    options?: ValidateOptions
): Promise<void> {
    const result = await validate(object, options);
    if (!result.valid) {
        throw new ValidationException(result.errors);
    }
}

/**
 * Validate and return transformed object
 */
export async function validateAndTransform<T extends object>(
    cls: new () => T,
    plain: unknown,
    options?: ValidateOptions
): Promise<T> {
    const instance = Object.assign(new cls(), plain);
    const result = await validate(instance, options);
    if (!result.valid) {
        throw new ValidationException(result.errors);
    }
    return result.value as T;
}

export class ValidationException extends Error {
    public readonly errors: ValidationError[];

    constructor(errors: ValidationError[]) {
        const message = errors
            .map(e => `${e.property}: ${e.message}`)
            .join(', ');
        super(`Validation failed: ${message}`);
        this.name = 'ValidationException';
        this.errors = errors;
    }

    toJSON(): { message: string; errors: ValidationError[] } {
        return {
            message: this.message,
            errors: this.errors,
        };
    }

    getMessages(): string[] {
        return this.flattenErrors(this.errors).map(e => e.message);
    }

    getErrorMap(): Record<string, string[]> {
        const map: Record<string, string[]> = {};
        for (const error of this.flattenErrors(this.errors)) {
            if (!map[error.property]) {
                map[error.property] = [];
            }
            map[error.property]!.push(error.message);
        }
        return map;
    }

    private flattenErrors(errors: ValidationError[], prefix = ''): ValidationError[] {
        const result: ValidationError[] = [];
        for (const error of errors) {
            const path = prefix ? `${prefix}.${error.property}` : error.property;
            result.push({ ...error, property: path });
            if (error.children) {
                result.push(...this.flattenErrors(error.children, path));
            }
        }
        return result;
    }
}

export function createValidationPipe(options?: ValidateOptions) {
    return async (value: unknown, metadata?: { metatype?: new () => unknown }) => {
        if (!metadata?.metatype) {
            return value;
        }

        const decoratedProps = getDecoratedProperties(metadata.metatype);
        if (decoratedProps.length === 0) {
            return value;
        }

        const instance = Object.assign(new metadata.metatype() as object, value);
        const result = await validate(instance, options);

        if (!result.valid) {
            throw new ValidationException(result.errors);
        }

        return result.value;
    };
}

export class Schema<T extends object = object> {
    private rules: Map<keyof T, ValidationConstraint[]> = new Map();
    private transforms: Map<keyof T, TransformFn[]> = new Map();

    property<K extends keyof T>(name: K): PropertyBuilder<T, K> {
        if (!this.rules.has(name)) {
            this.rules.set(name, []);
        }
        return new PropertyBuilder(this, name, this.rules.get(name)!, this.transforms);
    }

    async validate(object: T, options?: ValidateOptions): Promise<ValidationResult> {
        const errors: ValidationError[] = [];
        const obj = object as Record<string, unknown>;
        const transformedObj: Record<string, unknown> = { ...obj };

        for (const [property, transforms] of this.transforms) {
            let value = obj[property as string];
            for (const transform of transforms) {
                value = transform(value, obj);
            }
            transformedObj[property as string] = value;
        }

        for (const [property, constraints] of this.rules) {
            const value = transformedObj[property as string];

            for (const constraint of constraints) {
                if (constraint.condition && !constraint.condition(obj)) continue;

                const isValid = await constraint.validator(value, obj, property as string);
                if (!isValid) {
                    const message = typeof constraint.message === 'function'
                        ? constraint.message(value, constraint.args)
                        : constraint.message;

                    errors.push({
                        property: property as string,
                        constraint: constraint.name,
                        message,
                        value,
                    });

                    if (options?.stopAtFirstError) {
                        return { valid: false, errors, value: transformedObj };
                    }
                }
            }
        }

        return { valid: errors.length === 0, errors, value: transformedObj };
    }
}

class PropertyBuilder<T extends object, K extends keyof T> {
    constructor(
        private schema: Schema<T>,
        private property: K,
        private constraints: ValidationConstraint[],
        private transforms: Map<keyof T, TransformFn[]>
    ) { }

    private addConstraint(constraint: ValidationConstraint): this {
        this.constraints.push(constraint);
        return this;
    }

    private addTransform(transform: TransformFn): this {
        if (!this.transforms.has(this.property)) {
            this.transforms.set(this.property, []);
        }
        this.transforms.get(this.property)!.push(transform);
        return this;
    }

    isString(message?: string): this {
        return this.addConstraint({
            name: 'isString',
            validator: (v) => typeof v === 'string',
            message: message ?? 'Must be a string',
        });
    }

    isNumber(message?: string): this {
        return this.addConstraint({
            name: 'isNumber',
            validator: (v) => typeof v === 'number' && !isNaN(v),
            message: message ?? 'Must be a number',
        });
    }

    isBoolean(message?: string): this {
        return this.addConstraint({
            name: 'isBoolean',
            validator: (v) => typeof v === 'boolean',
            message: message ?? 'Must be a boolean',
        });
    }

    isRequired(message?: string): this {
        return this.addConstraint({
            name: 'isRequired',
            validator: (v) => v !== undefined && v !== null,
            message: message ?? 'Is required',
        });
    }

    minLength(min: number, message?: string): this {
        return this.addConstraint({
            name: 'minLength',
            validator: (v) => typeof v === 'string' && v.length >= min,
            message: message ?? `Must be at least ${min} characters`,
        });
    }

    maxLength(max: number, message?: string): this {
        return this.addConstraint({
            name: 'maxLength',
            validator: (v) => typeof v === 'string' && v.length <= max,
            message: message ?? `Must be at most ${max} characters`,
        });
    }

    isEmail(message?: string): this {
        return this.addConstraint({
            name: 'isEmail',
            validator: (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
            message: message ?? 'Must be a valid email',
        });
    }

    matches(pattern: RegExp, message?: string): this {
        return this.addConstraint({
            name: 'matches',
            validator: (v) => typeof v === 'string' && pattern.test(v),
            message: message ?? 'Must match pattern',
        });
    }

    min(min: number, message?: string): this {
        return this.addConstraint({
            name: 'min',
            validator: (v) => typeof v === 'number' && v >= min,
            message: message ?? `Must be at least ${min}`,
        });
    }

    max(max: number, message?: string): this {
        return this.addConstraint({
            name: 'max',
            validator: (v) => typeof v === 'number' && v <= max,
            message: message ?? `Must be at most ${max}`,
        });
    }

    custom(validator: ValidatorFn, message: string): this {
        return this.addConstraint({ name: 'custom', validator, message });
    }

    when(condition: (obj: T) => boolean): this {
        if (this.constraints.length > 0) {
            this.constraints[this.constraints.length - 1]!.condition = condition as (obj: unknown) => boolean;
        }
        return this;
    }

    trim(): this {
        return this.addTransform((v) => typeof v === 'string' ? v.trim() : v);
    }

    toLowerCase(): this {
        return this.addTransform((v) => typeof v === 'string' ? v.toLowerCase() : v);
    }

    toNumber(): this {
        return this.addTransform((v) => {
            const num = Number(v);
            return isNaN(num) ? v : num;
        });
    }

    default(value: unknown): this {
        return this.addTransform((v) => v === undefined || v === null ? value : v);
    }

    and(): Schema<T> {
        return this.schema;
    }
}

export function createSchema<T extends object>(): Schema<T> {
    return new Schema<T>();
}
