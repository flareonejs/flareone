/**
 * di module index.
 */

export {
    Container,
    getGlobalContainer,
    resetGlobalContainer,
    getTokenName,
    ContainerError,
    CircularDependencyError,
    TokenNotFoundError,
    type InjectOptions,
} from './container.js';

export {
    Injectable,
    Inject,
    Optional,
    Dependencies,
    Singleton,
    RequestScoped,
    Transient,
    type InjectableOptions,
    type InjectDecoratorOptions,
} from './decorators.js';
