/**
 * router module index.
 */

export {
    Router,
    getGlobalRouter,
    resetGlobalRouter,
    type RouteMatch,
    type RouteDefinition,
} from './radix-router.js';

export {
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
} from './decorators.js';

export {
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
    type CustomParamFactory,
} from './params.js';
