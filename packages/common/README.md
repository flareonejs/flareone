# @flareone/common

Common utilities, guards, pipes, and interceptors for Flareone framework.

## Installation

```bash
npm install @flareone/common
```

## Features

- **Guards**: `AuthGuard` base class
- **Interceptors**: `LoggingInterceptor`, `TimeoutInterceptor`
- **Pipes**: `ValidationPipe`, `ParseIntPipe`, `ParseBoolPipe`
- **Exceptions**: Standard HTTP exceptions
- **Decorators**: Helper decorators

## Usage

```typescript
import { UseGuards, UsePipes } from '@flareone/core';
import { AuthGuard, ValidationPipe } from '@flareone/common';

@Controller('cats')
@UseGuards(AuthGuard)
export class CatsController {
    @Post()
    @UsePipes(ValidationPipe)
    create(@Body() createCatDto: CreateCatDto) {
        return 'This action adds a new cat';
    }
}
```

See [main repository](https://github.com/flareonejs/flareone) for full documentation.
