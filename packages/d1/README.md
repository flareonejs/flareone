# @flareone/d1

D1 Database integration for Flareone framework.

## Installation

```bash
npm install @flareone/d1
```

## Features

- **Type-Safe**: Fluent Query Builder with full TypeScript support
- **Repository Pattern**: Built-in `D1Repository` for clean architecture
- **Zero Dependencies**: Lightweight wrapper around Cloudflare D1
- **Performance**: Optimized batch operations and transactions
- **Aggregations**: Support for `count`, `sum`, `avg`, `min`, `max`

## Usage

```typescript
import { Module, Injectable, Inject } from '@flareone/core';
import { D1Module, D1Service, D1Repository, table } from '@flareone/d1';

// 1. Register Module
@Module({
  imports: [
    D1Module.forRoot({ binding: 'DB' })
  ],
})
class AppModule {}

// 2. Define Entity & Repository
interface User {
  id: number;
  name: string;
  email: string;
}

@Injectable()
class UserRepository extends D1Repository<User> {
  constructor(@Inject(D1Service) d1: D1Service) {
    super(d1, 'users');
  }

  async findActive() {
    return this.find([{ column: 'active', operator: '=', value: true }]);
  }
}

// 3. Use in Service
@Injectable()
class UserService {
  constructor(
    @Inject(D1Service) private d1: D1Service,
    @Inject(UserRepository) private users: UserRepository
  ) {}

  async databaseOperations() {
    // Repository usage
    await this.users.create({ name: 'Alice', email: 'alice@example.com' });
    const user = await this.users.findById(1);

    // Fluent Query Builder usage
    const results = await table<User>(this.d1, 'users')
      .select('id', 'name')
      .where('email', 'LIKE', '%@example.com')
      .orderBy('id', 'DESC')
      .limit(5)
      .get();
      
    return { user, results };
  }
}
```

See [main repository](https://github.com/flareonejs/flareone) for full documentation.
