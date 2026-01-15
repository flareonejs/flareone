# @flareone/core

The core framework for Flareone - NestJS-like framework for Cloudflare Workers.

## Installation

```bash
npm install @flareone/core
```

## Features

- **Dependency Injection**: Lightweight DI container without reflect-metadata
- **Decorators**: `@Controller`, `@Module`, `@Injectable`, `@Inject`
- **Routing**: Efficient radix-tree based router
- **Cloudflare Native**: Designed specifically for Workers environment

## Usage

```typescript
import { 
  FlareoneFactory, 
  Module, 
  Controller, 
  Get, 
  Injectable, 
  Inject 
} from '@flareone/core';

@Injectable()
class AppService {
    getHello() { return 'Hello World!'; }
}

@Controller()
class AppController {
    constructor(@Inject(AppService) private appService: AppService) {}

    @Get('/')
    getHello() {
        return this.appService.getHello();
    }
}

@Module({
    controllers: [AppController],
    providers: [AppService]
})
class AppModule {}

const app = await FlareoneFactory.create(AppModule);
export default app.getHandler();
```

See [main repository](https://github.com/flareonejs/flareone) for full documentation.
