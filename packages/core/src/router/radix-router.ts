/**
 * Radix Tree Router
 * fastest way to find a route. don't touch the splitting logic, it's fragile.
 */

import type { HttpMethod } from '../constants.js';
import type { RouteHandler } from '../types.js';

export interface RouteMatch {
    handler: RouteHandler;
    params: Record<string, string>;
}

type NodeType = 'static' | 'param' | 'wildcard' | 'regex';

interface RadixNode {
    type: NodeType;
    segment: string;
    pattern?: RegExp;
    children: Map<string, RadixNode>;
    paramChild?: RadixNode;
    wildcardChild?: RadixNode;
    handlers: Map<HttpMethod, RouteHandler>;
    priority: number;
}

export interface RouteDefinition {
    method: HttpMethod;
    path: string;
    handler: RouteHandler;
}

export class Router {
    private root: RadixNode;
    private routes: RouteDefinition[] = [];

    constructor() {
        this.root = this.createNode('static', '');
    }

    // Registering routes... hope there are no conflicts.

    /**
     * Register a route handler
     */
    register(method: HttpMethod, path: string, handler: RouteHandler): this {
        // Normalize path
        const normalizedPath = this.normalizePath(path);
        const segments = this.splitPath(normalizedPath);

        let node = this.root;

        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i]!;
            node = this.insertSegment(node, segment);
        }

        if (node.handlers.has(method) && method !== 'ALL') {
            console.warn(`Route ${method} ${path} is being overwritten`);
        }
        node.handlers.set(method, handler);
        this.routes.push({ method, path, handler });

        return this;
    }

    /**
     * Register multiple routes at once
     */
    registerMany(routes: RouteDefinition[]): this {
        for (const route of routes) {
            this.register(route.method, route.path, route.handler);
        }
        return this;
    }

    /**
     * Find a matching route for the given method and path
     */
    match(method: HttpMethod, path: string): RouteMatch | null {
        const normalizedPath = this.normalizePath(path);
        const segments = this.splitPath(normalizedPath);
        const params: Record<string, string> = {};

        const handler = this.matchPath(this.root, segments, 0, params, method);

        if (handler) {
            return { handler, params };
        }

        return null;
    }

    /**
     * Check if a route exists
     */
    has(method: HttpMethod, path: string): boolean {
        return this.match(method, path) !== null;
    }

    /**
     * Get all registered routes
     */
    getRoutes(): RouteDefinition[] {
        return [...this.routes];
    }

    private createNode(type: NodeType, segment: string, pattern?: RegExp): RadixNode {
        return {
            type,
            segment,
            pattern,
            children: new Map(),
            handlers: new Map(),
            priority: type === 'static' ? 3 : type === 'param' ? 2 : type === 'regex' ? 1 : 0,
        };
    }

    private normalizePath(path: string): string {
        let normalized = path.replace(/\/+/g, '/');
        if (normalized.startsWith('/')) normalized = normalized.slice(1);
        if (normalized.endsWith('/')) normalized = normalized.slice(0, -1);
        return normalized;
    }

    private splitPath(path: string): string[] {
        if (!path) return [];
        return path.split('/').filter(Boolean);
    }

    private parseSegment(segment: string): { type: NodeType; name: string; pattern?: RegExp } {
        // Wildcard: *name or **
        if (segment.startsWith('*')) {
            const name = segment.slice(1) || 'wildcard';
            return { type: 'wildcard', name };
        }

        // Parameter: :name or :name(regex)
        if (segment.startsWith(':')) {
            const match = segment.match(/^:([^(]+)(?:\((.+)\))?$/);
            if (match) {
                const name = match[1]!;
                const pattern = match[2] ? new RegExp(`^${match[2]}$`) : undefined;
                return {
                    type: pattern ? 'regex' : 'param',
                    name,
                    pattern
                };
            }
        }

        // Static segment
        return { type: 'static', name: segment };
    }

    private insertSegment(parent: RadixNode, segment: string): RadixNode {
        const parsed = this.parseSegment(segment);

        switch (parsed.type) {
            case 'static': {
                const firstChar = segment[0] || '';
                let child = parent.children.get(firstChar);

                if (!child) {
                    child = this.createNode('static', segment);
                    parent.children.set(firstChar, child);
                } else if (child.segment !== segment) {
                    child = this.splitOrExtendNode(parent, child, segment, firstChar);
                }

                return child;
            }

            case 'param':
            case 'regex': {
                if (!parent.paramChild) {
                    parent.paramChild = this.createNode(parsed.type, parsed.name, parsed.pattern);
                } else if (parent.paramChild.segment !== parsed.name) {
                    console.warn(
                        `Parameter name mismatch: :${parent.paramChild.segment} vs :${parsed.name}`
                    );
                }
                return parent.paramChild;
            }

            case 'wildcard': {
                if (!parent.wildcardChild) {
                    parent.wildcardChild = this.createNode('wildcard', parsed.name);
                }
                return parent.wildcardChild;
            }
        }
    }

    private splitOrExtendNode(
        parent: RadixNode,
        existing: RadixNode,
        newSegment: string,
        firstChar: string
    ): RadixNode {
        const existingSegment = existing.segment;
        let commonLength = 0;
        const minLength = Math.min(existingSegment.length, newSegment.length);

        while (commonLength < minLength && existingSegment[commonLength] === newSegment[commonLength]) {
            commonLength++;
        }

        if (commonLength === existingSegment.length && commonLength === newSegment.length) {
            return existing;
        }
        if (commonLength === newSegment.length) {
            const commonNode = this.createNode('static', newSegment);
            existing.segment = existingSegment.slice(commonLength);
            commonNode.children.set(existing.segment[0] || '', existing);

            parent.children.set(firstChar, commonNode);
            return commonNode;
        }

        if (commonLength === existingSegment.length) {
            const remainingSegment = newSegment.slice(commonLength);
            const remainingFirstChar = remainingSegment[0] || '';

            let child = existing.children.get(remainingFirstChar);
            if (!child) {
                child = this.createNode('static', remainingSegment);
                existing.children.set(remainingFirstChar, child);
            }
            return child;
        }

        const commonPrefix = existingSegment.slice(0, commonLength);
        const commonNode = this.createNode('static', commonPrefix);

        existing.segment = existingSegment.slice(commonLength);
        commonNode.children.set(existing.segment[0] || '', existing);

        const newChild = this.createNode('static', newSegment.slice(commonLength));
        commonNode.children.set(newChild.segment[0] || '', newChild);

        parent.children.set(firstChar, commonNode);

        return newChild;
    }

    private matchPath(
        node: RadixNode,
        segments: string[],
        index: number,
        params: Record<string, string>,
        method: HttpMethod
    ): RouteHandler | null {
        if (index === segments.length) {
            return this.getHandler(node, method);
        }

        const segment = segments[index]!;

        const firstChar = segment[0] || '';
        const staticChild = node.children.get(firstChar);

        if (staticChild && segment.startsWith(staticChild.segment)) {
            if (staticChild.segment === segment) {
                const result = this.matchPath(staticChild, segments, index + 1, params, method);
                if (result) return result;
            } else if (segment.startsWith(staticChild.segment)) {
                const remaining = segment.slice(staticChild.segment.length);
                const nextFirstChar = remaining[0] || '';
                const nextChild = staticChild.children.get(nextFirstChar);

                if (nextChild && remaining === nextChild.segment) {
                    const result = this.matchPath(nextChild, segments, index + 1, params, method);
                    if (result) return result;
                }
            }
        }

        if (node.paramChild && node.paramChild.pattern) {
            if (node.paramChild.pattern.test(segment)) {
                const savedValue = params[node.paramChild.segment];
                params[node.paramChild.segment] = segment;

                const result = this.matchPath(node.paramChild, segments, index + 1, params, method);
                if (result) return result;

                if (savedValue !== undefined) {
                    params[node.paramChild.segment] = savedValue;
                } else {
                    delete params[node.paramChild.segment];
                }
            }
        }

        if (node.paramChild && !node.paramChild.pattern) {
            const savedValue = params[node.paramChild.segment];
            params[node.paramChild.segment] = segment;

            const result = this.matchPath(node.paramChild, segments, index + 1, params, method);
            if (result) return result;

            if (savedValue !== undefined) {
                params[node.paramChild.segment] = savedValue;
            } else {
                delete params[node.paramChild.segment];
            }
        }

        if (node.wildcardChild) {
            const remainingPath = segments.slice(index).join('/');
            params[node.wildcardChild.segment] = remainingPath;
            return this.getHandler(node.wildcardChild, method);
        }

        return null;
    }

    private getHandler(node: RadixNode, method: HttpMethod): RouteHandler | null {
        const handler = node.handlers.get(method);
        if (handler) return handler;

        const allHandler = node.handlers.get('ALL');
        if (allHandler) return allHandler;

        return null;
    }

    /**
     * Print the router tree for debugging
     */
    debug(): void {
        console.log('Router Tree:');
        this.printNode(this.root, 0);
    }

    private printNode(node: RadixNode, depth: number): void {
        const indent = '  '.repeat(depth);
        const handlers = Array.from(node.handlers.keys()).join(', ') || 'none';

        let prefix = '';
        switch (node.type) {
            case 'param':
                prefix = ':';
                break;
            case 'wildcard':
                prefix = '*';
                break;
            case 'regex':
                prefix = ':';
                break;
        }

        console.log(`${indent}${prefix}${node.segment} [${node.type}] handlers: ${handlers}`);

        for (const child of node.children.values()) {
            this.printNode(child, depth + 1);
        }

        if (node.paramChild) {
            this.printNode(node.paramChild, depth + 1);
        }

        if (node.wildcardChild) {
            this.printNode(node.wildcardChild, depth + 1);
        }
    }
}

let globalRouter: Router | null = null;

/**
 * Get the global router instance
 */
export function getGlobalRouter(): Router {
    if (!globalRouter) {
        globalRouter = new Router();
    }
    return globalRouter;
}

/**
 * Reset the global router (for testing)
 */
export function resetGlobalRouter(): void {
    globalRouter = null;
}
