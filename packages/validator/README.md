# @flareone/validator

Complete validation decorators for Flareone framework.

## Installation

```bash
npm install @flareone/validator
```

## Features

- **No Reflect Metadata**: Works entirely without `reflect-metadata`
- **Standard Validators**: `IsString`, `IsInt`, `IsEmail`, `IsUUID`, etc.
- **Nested Validation**: Support for nested DTOs via `@Type()`
- **Arrays**: `IsArray`, `IsArrayOf`, `ArrayMinSize`
- **Transformation**: Built-in transformation support

## Usage

```typescript
import { 
  IsString, 
  IsInt, 
  IsEmail, 
  Min,
  ValidateNested, 
  Type,
  IsArrayOf
} from '@flareone/validator';

class TagDto {
  @IsString()
  name: string;
}

class ProfileDto {
  @IsString()
  avatarUrl: string;
}

export class CreateUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsInt()
  @Min(18)
  age: number;

  @IsArrayOf(() => TagDto)
  tags: TagDto[];

  @ValidateNested()
  @Type(() => ProfileDto)
  profile: ProfileDto;
}
```

See [main repository](https://github.com/flareonejs/flareone) for full documentation.
