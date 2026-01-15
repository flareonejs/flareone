# @flareone/kv

Workers KV integration for Flareone framework.

## Installation

```bash
npm install @flareone/kv
```

## Features

- **Type-safe Wrapper**: High-level API for `KVNamespace`
- **Caching**: Built-in TTL and caching strategies
- **Repository Pattern**: `KVRepository` base class for entity management
- **Batch Operations**: Efficient `setMany`, `deleteMany`, `list`
- **Metadata Support**: Simple API for storing/retrieving metadata

## Usage

```typescript
import { Module, Injectable, Inject } from '@flareone/core';
import { KVModule, KVService } from '@flareone/kv';

@Injectable()
class CacheService {
  constructor(@Inject(KVService) private kv: KVService) {}

  async saveUser(id: string, data: any) {
    // Automatic JSON serialization + TTL
    await this.kv.set(`user:${id}`, data, { expirationTtl: 3600 });
  }
}

@Module({
  imports: [
    KVModule.forRoot({
      binding: 'MY_KV', // Binding name in wrangler.toml
      keyPrefix: 'app:'
    })
  ]
})
class AppModule {}
```

See [main repository](https://github.com/flareonejs/flareone) for full documentation.
