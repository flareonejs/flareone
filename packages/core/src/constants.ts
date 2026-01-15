/**
 * core constants and metadata keys.
 * if you change these, you're looking for trouble.
 */

/** Prefix for all Flareone metadata keys to avoid collisions */
export const METADATA_PREFIX = '__flareone__';

/** Module metadata keys */
export const MODULE_METADATA = {
    IMPORTS: `${METADATA_PREFIX}:imports`,
    EXPORTS: `${METADATA_PREFIX}:exports`,
    PROVIDERS: `${METADATA_PREFIX}:providers`,
    CONTROLLERS: `${METADATA_PREFIX}:controllers`,
    IS_GLOBAL: `${METADATA_PREFIX}:isGlobal`,
    IS_DYNAMIC: `${METADATA_PREFIX}:isDynamic`,
} as const;

/** Injectable/Provider metadata keys */
export const INJECTABLE_METADATA = {
    SCOPE: `${METADATA_PREFIX}:scope`,
    DEPENDENCIES: `${METADATA_PREFIX}:dependencies`,
    TOKEN: `${METADATA_PREFIX}:token`,
    IS_INJECTABLE: `${METADATA_PREFIX}:isInjectable`,
} as const;

/** Controller metadata keys */
export const CONTROLLER_METADATA = {
    PATH: `${METADATA_PREFIX}:path`,
    VERSION: `${METADATA_PREFIX}:version`,
    HOST: `${METADATA_PREFIX}:host`,
    SCOPE: `${METADATA_PREFIX}:scope`,
    IS_CONTROLLER: `${METADATA_PREFIX}:isController`,
} as const;

/** Route metadata keys */
export const ROUTE_METADATA = {
    PATH: `${METADATA_PREFIX}:route:path`,
    METHOD: `${METADATA_PREFIX}:route:method`,
    STATUS_CODE: `${METADATA_PREFIX}:route:statusCode`,
    HEADERS: `${METADATA_PREFIX}:route:headers`,
    REDIRECT: `${METADATA_PREFIX}:route:redirect`,
    RENDER: `${METADATA_PREFIX}:route:render`,
} as const;

/** Parameter metadata keys */
export const PARAM_METADATA = {
    PARAMS: `${METADATA_PREFIX}:params`,
    QUERY: `${METADATA_PREFIX}:query`,
    BODY: `${METADATA_PREFIX}:body`,
    HEADERS: `${METADATA_PREFIX}:headers`,
    REQUEST: `${METADATA_PREFIX}:request`,
    RESPONSE: `${METADATA_PREFIX}:response`,
    CONTEXT: `${METADATA_PREFIX}:context`,
    ENV: `${METADATA_PREFIX}:env`,
    CUSTOM: `${METADATA_PREFIX}:custom`,
} as const;

/** Guard metadata keys */
export const GUARD_METADATA = {
    GUARDS: `${METADATA_PREFIX}:guards`,
    IS_GUARD: `${METADATA_PREFIX}:isGuard`,
} as const;

/** Interceptor metadata keys */
export const INTERCEPTOR_METADATA = {
    INTERCEPTORS: `${METADATA_PREFIX}:interceptors`,
    IS_INTERCEPTOR: `${METADATA_PREFIX}:isInterceptor`,
} as const;

/** Pipe metadata keys */
export const PIPE_METADATA = {
    PIPES: `${METADATA_PREFIX}:pipes`,
    IS_PIPE: `${METADATA_PREFIX}:isPipe`,
} as const;

/** Filter metadata keys */
export const FILTER_METADATA = {
    FILTERS: `${METADATA_PREFIX}:filters`,
    IS_FILTER: `${METADATA_PREFIX}:isFilter`,
    CATCH: `${METADATA_PREFIX}:catch`,
} as const;

/** Middleware metadata keys */
export const MIDDLEWARE_METADATA = {
    MIDDLEWARES: `${METADATA_PREFIX}:middlewares`,
    IS_MIDDLEWARE: `${METADATA_PREFIX}:isMiddleware`,
} as const;

export const HTTP_METHODS = {
    GET: 'GET',
    POST: 'POST',
    PUT: 'PUT',
    DELETE: 'DELETE',
    PATCH: 'PATCH',
    OPTIONS: 'OPTIONS',
    HEAD: 'HEAD',
    ALL: 'ALL',
} as const;

export type HttpMethod = (typeof HTTP_METHODS)[keyof typeof HTTP_METHODS];

export const SCOPE = {
    /** Default - single instance shared across the entire application */
    SINGLETON: 'singleton',
    /** New instance created for each request */
    REQUEST: 'request',
    /** New instance created every time it's injected */
    TRANSIENT: 'transient',
} as const;

export type ProviderScope = (typeof SCOPE)[keyof typeof SCOPE];


export const HTTP_STATUS = {
    // 2xx Success
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,

    // 3xx Redirection
    MOVED_PERMANENTLY: 301,
    FOUND: 302,
    SEE_OTHER: 303,
    NOT_MODIFIED: 304,
    TEMPORARY_REDIRECT: 307,
    PERMANENT_REDIRECT: 308,

    // 4xx Client Errors
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    NOT_ACCEPTABLE: 406,
    CONFLICT: 409,
    GONE: 410,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,

    // 5xx Server Errors
    INTERNAL_SERVER_ERROR: 500,
    NOT_IMPLEMENTED: 501,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504,
} as const;

export type HttpStatus = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];

export const CONTENT_TYPE = {
    JSON: 'application/json',
    TEXT: 'text/plain',
    HTML: 'text/html',
    XML: 'application/xml',
    FORM_URLENCODED: 'application/x-www-form-urlencoded',
    MULTIPART: 'multipart/form-data',
    OCTET_STREAM: 'application/octet-stream',
} as const;

export type ContentType = (typeof CONTENT_TYPE)[keyof typeof CONTENT_TYPE];

export const FLAREONE_VERSION = '0.1.0';
export const FLAREONE_NAME = 'Flareone';
