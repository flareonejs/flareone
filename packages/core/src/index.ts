/**
 * @packageDocumentation
 * @module @flareone/core
 * 
 * the heart of flareon. don't touch if you don't want to break everything.
 */

export { FLAREONE_VERSION, FLAREONE_NAME } from './constants.js';

export {
    HTTP_METHODS,
    HTTP_STATUS,
    CONTENT_TYPE,
    SCOPE,
    type HttpMethod,
    type HttpStatus,
    type ContentType,
    type ProviderScope,
} from './constants.js';

export type {
    // Utility types
    Type,
    AbstractType,
    Func,
    AsyncFunc,
    DeepPartial,
    AsyncReturnType,

    // Injection
    InjectionToken,
    InjectionTokenSymbol,
    ForwardRef,

    // Providers
    Provider,
    ClassProvider,
    ValueProvider,
    FactoryProvider,
    ExistingProvider,

    // Module
    ModuleMetadata,
    DynamicModule,
    ModuleOptions,

    // Controller & Routes
    ControllerOptions,
    RouteMetadata,
    RouteHandler,
    ParameterMetadata,

    // Middleware
    MiddlewareFunction,
    Middleware,
    MiddlewareConfig,
    RouteInfo,

    // Guards
    Guard,

    // Interceptors
    Interceptor,
    CallHandler,

    // Pipes
    PipeTransform,
    ArgumentMetadata,

    // Exception Filters
    ExceptionFilter,
    ExceptionFilterMetadata,

    // Context
    ExecutionContextWrapper,

    // Application
    WorkerEnv,
    FlareoneApplicationOptions,
    CorsOptions,
    LoggingOptions,

    // Lifecycle
    OnModuleInit,
    OnModuleDestroy,
    OnApplicationBootstrap,
    OnApplicationShutdown,

    // Cloudflare Bindings
    CloudflareBinding,
    KVBinding,
    DurableObjectBinding,
    R2Binding,
    D1Binding,
    QueueBinding,
    ServiceBinding,
} from './types.js';

export {
    createToken,
    forwardRef,
    isForwardRef,
    resolveForwardRef,
    isClassProvider,
    isValueProvider,
    isFactoryProvider,
    isExistingProvider,
    isTypeProvider,
} from './types.js';

export {
    defineClassMetadata,
    getClassMetadata,
    hasClassMetadata,
    getClassMetadataKeys,
    defineMethodMetadata,
    getMethodMetadata,
    hasMethodMetadata,
    getDecoratedMethods,
    getAllMethodMetadata,
    defineParameterMetadata,
    getParameterMetadata,
    getAllParameterMetadata,
    getParameterIndices,
    definePropertyMetadata,
    getPropertyMetadata,
    getDecoratedProperties,
    appendClassMetadata,
    appendMethodMetadata,
    mergeClassMetadata,
    inheritMetadata,
    debugMetadata,
} from './metadata.js';

export {
    Container,
    getGlobalContainer,
    resetGlobalContainer,
    getTokenName,
    ContainerError,
    CircularDependencyError,
    TokenNotFoundError,
    Injectable,
    Inject,
    Optional,
    Dependencies,
    Singleton,
    RequestScoped,
    Transient,
    type InjectOptions,
    type InjectableOptions,
    type InjectDecoratorOptions,
} from './di/index.js';

export {
    Router,
    getGlobalRouter,
    resetGlobalRouter,
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Patch,
    Options,
    Head,
    All,
    HttpCode,
    Header,
    Redirect,
    Version,
    Host,
    Param,
    Query,
    Body,
    Headers,
    Req,
    Request,
    Res,
    Response,
    Ctx,
    Context,
    Env,
    Ip,
    UserAgent,
    HostParam,
    createParamDecoratorFactory,
    getParameterDecorators,
    type RouteMatch,
    type RouteDefinition,
    type CustomParamFactory,
} from './router/index.js';

export {
    Module,
    Global,
    getModuleMetadata,
    isGlobalModule,
    isDynamicModule,
    createOptionsToken,
    UseGuards,
    UseInterceptors,
    UsePipes,
    UseFilters,
    Catch,
    SetMetadata,
    Public,
    Roles,
    Throttle,
    SkipThrottle,
    getGuards,
    getInterceptors,
    getPipes,
    getFilters,
    getCaughtExceptions,
    type ConfigurableModuleFactory,
    type AsyncModuleOptions,
} from './decorators/index.js';

export {
    HttpException,
    BadRequestException,
    UnauthorizedException,
    ForbiddenException,
    NotFoundException,
    MethodNotAllowedException,
    NotAcceptableException,
    ConflictException,
    GoneException,
    UnprocessableEntityException,
    TooManyRequestsException,
    InternalServerErrorException,
    NotImplementedException,
    BadGatewayException,
    ServiceUnavailableException,
    GatewayTimeoutException,
    ValidationException,
    isHttpException,
    toHttpException,
    errorToResponse,
    type ValidationError,
} from './exceptions/index.js';

export {
    FlareoneApplication,
    FlareoneFactory,
    FlareoneExecutionContext,
    FlareoneCallHandler,
} from './application/index.js';
