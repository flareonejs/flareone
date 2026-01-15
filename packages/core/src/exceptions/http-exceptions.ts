/**
 * HTTP Exceptions
 * standard errors so you don't have to guess the status code.
 */

import { HTTP_STATUS, type HttpStatus } from '../constants.js';

interface ErrorConstructorWithCapture extends ErrorConstructor {
    captureStackTrace?(targetObject: object, constructorOpt?: Function): void;
}

/**
 * Base class for all HTTP exceptions
 */
export class HttpException extends Error {
    public readonly status: HttpStatus;
    public readonly response: string | object;
    public readonly cause?: Error;

    constructor(response: string | object, status: HttpStatus, cause?: Error) {
        const message = typeof response === 'string' ? response : JSON.stringify(response);
        super(message);

        this.name = 'HttpException';
        this.status = status;
        this.response = response;
        this.cause = cause;

        const ErrorWithCapture = Error as ErrorConstructorWithCapture;
        ErrorWithCapture.captureStackTrace?.(this, this.constructor);
    }

    /**
     * Get the response body for the exception
     */
    getResponse(): string | object {
        return this.response;
    }

    /**
     * Get the HTTP status code
     */
    getStatus(): HttpStatus {
        return this.status;
    }

    /**
     * Convert exception to a Response object
     */
    toResponse(): Response {
        const body = typeof this.response === 'string'
            ? JSON.stringify({ statusCode: this.status, message: this.response })
            : JSON.stringify({ statusCode: this.status, ...this.response });

        return new Response(body, {
            status: this.status,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}

// 4xx Errors

/**
 * 400 Bad Request
 */
export class BadRequestException extends HttpException {
    constructor(message: string | object = 'Bad Request', cause?: Error) {
        super(message, HTTP_STATUS.BAD_REQUEST, cause);
        this.name = 'BadRequestException';
    }
}

/**
 * 401 Unauthorized
 */
export class UnauthorizedException extends HttpException {
    constructor(message: string | object = 'Unauthorized', cause?: Error) {
        super(message, HTTP_STATUS.UNAUTHORIZED, cause);
        this.name = 'UnauthorizedException';
    }
}

/**
 * 403 Forbidden
 */
export class ForbiddenException extends HttpException {
    constructor(message: string | object = 'Forbidden', cause?: Error) {
        super(message, HTTP_STATUS.FORBIDDEN, cause);
        this.name = 'ForbiddenException';
    }
}

/**
 * 404 Not Found
 */
export class NotFoundException extends HttpException {
    constructor(message: string | object = 'Not Found', cause?: Error) {
        super(message, HTTP_STATUS.NOT_FOUND, cause);
        this.name = 'NotFoundException';
    }
}

/**
 * 405 Method Not Allowed
 */
export class MethodNotAllowedException extends HttpException {
    constructor(message: string | object = 'Method Not Allowed', cause?: Error) {
        super(message, HTTP_STATUS.METHOD_NOT_ALLOWED, cause);
        this.name = 'MethodNotAllowedException';
    }
}

/**
 * 406 Not Acceptable
 */
export class NotAcceptableException extends HttpException {
    constructor(message: string | object = 'Not Acceptable', cause?: Error) {
        super(message, HTTP_STATUS.NOT_ACCEPTABLE, cause);
        this.name = 'NotAcceptableException';
    }
}

/**
 * 409 Conflict
 */
export class ConflictException extends HttpException {
    constructor(message: string | object = 'Conflict', cause?: Error) {
        super(message, HTTP_STATUS.CONFLICT, cause);
        this.name = 'ConflictException';
    }
}

/**
 * 410 Gone
 */
export class GoneException extends HttpException {
    constructor(message: string | object = 'Gone', cause?: Error) {
        super(message, HTTP_STATUS.GONE, cause);
        this.name = 'GoneException';
    }
}

/**
 * 422 Unprocessable Entity
 */
export class UnprocessableEntityException extends HttpException {
    constructor(message: string | object = 'Unprocessable Entity', cause?: Error) {
        super(message, HTTP_STATUS.UNPROCESSABLE_ENTITY, cause);
        this.name = 'UnprocessableEntityException';
    }
}

/**
 * 429 Too Many Requests
 */
export class TooManyRequestsException extends HttpException {
    public readonly retryAfter?: number;

    constructor(
        message: string | object = 'Too Many Requests',
        retryAfter?: number,
        cause?: Error
    ) {
        super(message, HTTP_STATUS.TOO_MANY_REQUESTS, cause);
        this.name = 'TooManyRequestsException';
        this.retryAfter = retryAfter;
    }

    override toResponse(): Response {
        const response = super.toResponse();
        if (this.retryAfter) {
            const headers = new Headers(response.headers);
            headers.set('Retry-After', String(this.retryAfter));
            return new Response(response.body, {
                status: response.status,
                headers,
            });
        }
        return response;
    }
}

// 5xx Errors

/**
 * 500 Internal Server Error
 */
export class InternalServerErrorException extends HttpException {
    constructor(message: string | object = 'Internal Server Error', cause?: Error) {
        super(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, cause);
        this.name = 'InternalServerErrorException';
    }
}

/**
 * 501 Not Implemented
 */
export class NotImplementedException extends HttpException {
    constructor(message: string | object = 'Not Implemented', cause?: Error) {
        super(message, HTTP_STATUS.NOT_IMPLEMENTED, cause);
        this.name = 'NotImplementedException';
    }
}

/**
 * 502 Bad Gateway
 */
export class BadGatewayException extends HttpException {
    constructor(message: string | object = 'Bad Gateway', cause?: Error) {
        super(message, HTTP_STATUS.BAD_GATEWAY, cause);
        this.name = 'BadGatewayException';
    }
}

/**
 * 503 Service Unavailable
 */
export class ServiceUnavailableException extends HttpException {
    constructor(message: string | object = 'Service Unavailable', cause?: Error) {
        super(message, HTTP_STATUS.SERVICE_UNAVAILABLE, cause);
        this.name = 'ServiceUnavailableException';
    }
}

/**
 * 504 Gateway Timeout
 */
export class GatewayTimeoutException extends HttpException {
    constructor(message: string | object = 'Gateway Timeout', cause?: Error) {
        super(message, HTTP_STATUS.GATEWAY_TIMEOUT, cause);
        this.name = 'GatewayTimeoutException';
    }
}

export interface ValidationError {
    property: string;
    constraints: Record<string, string>;
    value?: unknown;
    children?: ValidationError[];
}

/**
 * Validation exception with detailed errors
 */
export class ValidationException extends BadRequestException {
    public readonly errors: ValidationError[];

    constructor(errors: ValidationError[], message: string = 'Validation failed') {
        super({
            message,
            errors: errors.map((e) => ({
                property: e.property,
                constraints: e.constraints,
                value: e.value,
            })),
        });
        this.name = 'ValidationException';
        this.errors = errors;
    }
}

/**
 * Check if an error is an HttpException
 */
export function isHttpException(error: unknown): error is HttpException {
    return error instanceof HttpException;
}

/**
 * Create an HttpException from any error
 */
export function toHttpException(error: unknown): HttpException {
    if (isHttpException(error)) {
        return error;
    }

    if (error instanceof Error) {
        return new InternalServerErrorException(error.message, error);
    }

    return new InternalServerErrorException(String(error));
}

/**
 * Create a response from an error
 */
export function errorToResponse(error: unknown, includeStack = false): Response {
    const exception = toHttpException(error);

    if (includeStack && exception.stack) {
        const body = typeof exception.response === 'string'
            ? { statusCode: exception.status, message: exception.response, stack: exception.stack }
            : { statusCode: exception.status, ...exception.response, stack: exception.stack };

        return new Response(JSON.stringify(body), {
            status: exception.status,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    return exception.toResponse();
}
