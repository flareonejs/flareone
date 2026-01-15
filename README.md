<div align="center">
  <h1>🔥 Flareone</h1>
  <p><strong>NestJS-like framework for Cloudflare Workers</strong></p>
  
  [![npm version](https://img.shields.io/npm/v/@flareone/core.svg)](https://www.npmjs.com/package/@flareone/core)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
</div>

---

## ✨ Features

- 🚀 **Edge-First** — Designed specifically for Cloudflare Workers
- 🔥 **NestJS-like DX** — Decorators, DI, modules, guards, pipes, interceptors
- 📦 **No reflect-metadata** — Lightweight DI without heavy polyfills
- 🎯 **Type-Safe** — Full TypeScript support with strict typing
- ☁️ **Cloudflare Native** — First-class support for KV, R2, D1, Durable Objects

## 📦 Packages

| Package | Description | Status |
|---------|-------------|--------|
| `@flareone/core` | Core framework (DI, routing, decorators) | ✅ Ready |
| `@flareone/common` | Guards, interceptors, pipes | ✅ Ready |
| `@flareone/kv` | Workers KV integration | ✅ Ready |
| `@flareone/d1` | D1 Database ORM | 🚧 WIP |
| `@flareone/r2` | R2 Object Storage | 🚧 WIP |
| `@flareone/durable` | Durable Objects helpers | 🚧 WIP |
| `@flareone/queues` | Queue producers and consumers | 🚧 WIP |
| `@flareone/ai` | Workers AI integration | 🚧 WIP |
| `@flareone/validator` | DTO validation (zod/class-validator) | 🚧 WIP |
| `@flareone/cli` | CLI tools (generators, dev server) | 🚧 WIP |
| `@flareone/websocket` | WebSocket utilities | 🚧 WIP |
| `@flareone/graphql` | GraphQL integration | 🚧 Planned |
| `@flareone/analytics` | Cloudflare Analytics | 🚧 Planned |
| `@flareone/email` | Email Engine integration | 🚧 Planned |
| `@flareone/workflows` | Cloudflare Workflows | 🚧 Planned |
| `@flareone/browser` | Browser automation (Puppeteer) | 🚧 Planned |
| `@flareone/vectorize` | Vector database integration | 🚧 Planned |

## 🚀 Quick Start

### Installation

```bash
pnpm add @flareone/core
# or
npm install @flareone/core
```

### Basic Example

```typescript
import { 
  FlareoneFactory, 
  Module, 
  Controller, 
  Get, 
  Post, 
  Param, 
  Body,
  Injectable,
  Inject
} from '@flareone/core';

// Service
@Injectable()
class UserService {
  private users = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' }
  ];

  findAll() {
    return this.users;
  }

  findById(id: number) {
    return this.users.find(u => u.id === id);
  }
}

// Controller - use @Inject() for dependencies
@Controller('/users')
class UserController {
  constructor(@Inject(UserService) private userService: UserService) {}

  @Get('/')
  findAll() {
    return this.userService.findAll();
  }

  @Get('/:id')
  findOne(@Param('id') id: string) {
    return this.userService.findById(parseInt(id));
  }
}

// Module
@Module({
  controllers: [UserController],
  providers: [UserService],
})
class AppModule {}

// Bootstrap
const app = await FlareoneFactory.create(AppModule);

export default app.getHandler();
```

### wrangler.toml

```toml
name = "my-app"
main = "src/index.ts"
compatibility_date = "2026-01-01"
compatibility_flags = ["nodejs_compat"]
```

## 📖 Core Concepts

### Dependency Injection

Flareone uses lightweight DI **without reflect-metadata**. Use `@Inject()` decorator for dependencies:

```typescript
@Injectable()
class DatabaseService {
  async query(sql: string) { /* ... */ }
}

@Injectable()
class UserService {
  // @Inject() is REQUIRED for dependencies
  constructor(@Inject(DatabaseService) private db: DatabaseService) {}
}
```

### Controllers

```typescript
@Controller('/api/users')
class UserController {
  @Get('/')
  findAll(@Query('limit') limit: string) {
    return { users: [], limit };
  }

  @Get('/:id')
  findOne(@Param('id') id: string) {
    return { id };
  }

  @Post('/')
  @HttpCode(201)
  create(@Body() data: unknown) {
    return data;
  }
}
```

### Guards

```typescript
import { UseGuards } from '@flareone/core';
import { JwtGuard } from '@flareone/common';

@Controller('/admin')
@UseGuards(new JwtGuard({ secret: 'my-secret' }))
class AdminController {
  @Get('/dashboard')
  dashboard() {
    return { data: 'secret' };
  }
}
```

### Interceptors

```typescript
import { UseInterceptors } from '@flareone/core';
import { LoggingInterceptor } from '@flareone/common';

@Controller('/api')
@UseInterceptors(LoggingInterceptor)
class ApiController {
  @Get('/data')
  getData() {
    return { message: 'Hello' };
  }
}
```

### Cloudflare Bindings

Access KV, D1, R2, AI through `@Env()`:

```typescript
interface Env {
  KV: KVNamespace;
  DB: D1Database;
}

@Controller('/data')
class DataController {
  @Get('/kv/:key')
  async getFromKV(@Param('key') key: string, @Env() env: Env) {
    return env.KV.get(key);
  }
}
```

## 🎯 Performance

Benchmarked on real Cloudflare Edge (not localhost):

| Framework | RPS | Latency | Features |
|-----------|-----|---------|----------|
| Bare Workers | 292 | 102ms | None |
| Hono | 296 | 101ms | Routing |
| itty-router | 277 | 107ms | Routing |
| **Flareone** | 276 | 108ms | DI + Guards + Interceptors + Pipes + Modules |

**~4% overhead** for full NestJS-like feature set.

## 📚 API Reference

### Decorators

| Decorator | Description |
|-----------|-------------|
| `@Controller(path)` | Define a controller |
| `@Get()`, `@Post()`, `@Put()`, `@Delete()`, `@Patch()` | HTTP methods |
| `@Param(name)` | Route parameter |
| `@Query(name)` | Query parameter |
| `@Body()` | Request body |
| `@Headers(name)` | Request header |
| `@Req()` | Request object |
| `@Env()` | Cloudflare env bindings |
| `@Ctx()` | Cloudflare execution context |
| `@Injectable()` | Mark class as injectable |
| `@Inject(token)` | Inject dependency |
| `@Module(options)` | Define a module |
| `@UseGuards(...)` | Apply guards |
| `@UseInterceptors(...)` | Apply interceptors |
| `@UsePipes(...)` | Apply pipes |

### Exceptions

```typescript
import { 
  HttpException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException
} from '@flareone/core';

throw new NotFoundException('User not found');
```

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a PR.

## 📄 License

MIT © [Flareone Contributors](https://github.com/flareonejs/flareone)

---

<div align="center">
  <p>Built with ❤️ for the edge</p>
  <p>
    <a href="https://github.com/flareonejs/flareone">GitHub</a>
  </p>
</div>
