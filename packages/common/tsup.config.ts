import { defineConfig } from 'tsup';

export default defineConfig({
    entry: {
        index: 'src/index.ts',
        'pipes/index': 'src/pipes/index.ts',
        'guards/index': 'src/guards/index.ts',
        'interceptors/index': 'src/interceptors/index.ts',
        'utils/index': 'src/utils/index.ts',
    },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    target: 'es2022',
    platform: 'browser',
    external: ['@flareone/core'],
});
