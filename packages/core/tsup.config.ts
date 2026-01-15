import { defineConfig } from 'tsup';

export default defineConfig({
    entry: {
        index: 'src/index.ts',
        'decorators/index': 'src/decorators/index.ts',
        'di/index': 'src/di/index.ts',
        'router/index': 'src/router/index.ts',
        'application/index': 'src/application/index.ts',
    },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    minify: false,
    splitting: true,
    target: 'es2022',
    platform: 'browser',
    external: [],
});
